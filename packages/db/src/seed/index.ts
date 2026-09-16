/* eslint-disable no-console */
import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_BY_SLUG,
  SERVICE_CATEGORIES,
  type DealType,
  type ListingStatus,
  slugify,
} from '@lokacia/contracts';
import { DATABASE_URL } from '../env';
import { createDb, type Tx } from '../client';
import * as s from '../schema/index';
import { newId } from '../schema/_common';
import {
  COMPETITOR_NAMES,
  CITY_NAMES,
  DEMAND_TITLES,
  DESCRIPTION_SENTENCES,
  DISTRICT_NAMES,
  EQUIPMENT,
  FIRST_NAMES,
  GENERIC_PERMITS,
  HISTORY_BUSINESSES,
  LAST_NAMES,
  PERMITS,
  REVIEW_TEXTS,
  SERVICE_PROVIDERS,
  STREETS,
  TITLE_PATTERNS,
  rng,
} from './content';
import tbilisi from './data/tbilisi-districts.json';
import regions from './data/region-districts.json';
import { seedCrm } from './crm';
import { seedBilling } from './billing';

const R = rng(20260916);
const DAY = 86_400_000;
const NOW = new Date();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);
const daysFrom = (d: number) => new Date(NOW.getTime() + d * DAY);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const token = () => randomBytes(18).toString('base64url');

export const DEMO_PHONES = {
  admin: '+995500000001',
  moderator: '+995500000002',
  owner: '+995500000003',
  agencyManager: '+995500000004',
  agent: '+995500000005',
  tenant: '+995500000006',
  developer: '+995500000007',
  provider: '+995500000008',
  assistant: '+995500000009',
  agency2Manager: '+995500000010',
} as const;

const LISTING_COUNT = Number(process.env.SEED_LISTINGS ?? 700);

async function insertMany<T extends PgTable>(tx: Tx, table: T, rows: T['$inferInsert'][], chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await tx.insert(table).values(rows.slice(i, i + chunk) as any);
  }
}

function personName() {
  return `${R.pick(FIRST_NAMES)} ${R.pick(LAST_NAMES)}`;
}
function fakePhone(i: number) {
  return `+99559${String(1000000 + i * 7919).slice(-7)}`;
}

/** Random point inside a (multi)polygon by rejection sampling on its bbox. */
function pointIn(boundary: { coordinates: number[][][][] }): [number, number] {
  const ring = boundary.coordinates[0]![0]!;
  const xs = ring.map((p) => p[0]!);
  const ys = ring.map((p) => p[1]!);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let i = 0; i < 200; i++) {
    const x = R.float(minX, maxX, 6);
    const y = R.float(minY, maxY, 6);
    if (inRing([x, y], ring)) return [y, x];
  }
  return [(minY + maxY) / 2, (minX + maxX) / 2];
}
function inRing([x, y]: [number, number], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

type DistrictRow = { id: string; slug: string; city: string; boundary: { type: 'MultiPolygon'; coordinates: number[][][][] }; rentM2: number };

export async function seed() {
  const { db, client } = createDb(process.env.SEED_DATABASE_URL ?? DATABASE_URL, { max: 1 });
  const started = Date.now();

  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.bypass_rls', 'on', true)`);
    const tables = await tx.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public'`,
    );
    const names = tables.map((t) => `"${t.tablename}"`).join(', ');
    if (names) await tx.execute(sql.raw(`TRUNCATE ${names} CASCADE`));

    /* ---------- settings ---------- */
    await insertMany(tx, s.settings, [
      { key: 'launch_promo_until', value: isoDate(daysFrom(75)) },
      { key: 'liveness_interval_days', value: 12 },
      { key: 'liveness_grace_hours', value: 72 },
      { key: 'demand_expiry_days', value: 30 },
      { key: 'reveal_rate_limit_per_hour', value: 20 },
      { key: 'services_commission_pct', value: 10 },
      { key: 'transfer_commission_pct', value: 1.5 },
      { key: 'vat_pct', value: 18 },
    ]);

    /* ---------- taxonomy ---------- */
    const btRows = BUSINESS_TYPES.map((t, i) => ({
      id: newId(),
      slug: t.slug,
      nameKa: t.nameKa,
      nameEn: t.nameEn,
      nameRu: t.nameRu,
      icon: t.icon,
      filterConfig: t.filterConfig,
      utilityCoef: t.utilityCoef,
      fitoutPerM2Minor: t.fitoutPerM2 * 100,
      sort: i,
    }));
    await insertMany(tx, s.businessTypes, btRows);

    const districts: DistrictRow[] = [];
    const districtRows = [
      ...tbilisi.map((d) => ({ ...d, city: 'tbilisi' })),
      ...regions,
    ].map((d) => {
      const names = DISTRICT_NAMES[d.slug]!;
      const row = {
        id: newId(),
        city: d.city,
        slug: d.slug,
        nameKa: names.ka,
        nameEn: names.en,
        nameRu: names.ru,
        boundary: d.boundary as DistrictRow['boundary'],
        centerLat: d.lat,
        centerLng: d.lng,
        avgPriceM2Minor: names.rentM2 * 100,
        avgSalePriceM2Minor: names.rentM2 * 100 * 115,
      };
      districts.push({ id: row.id, slug: d.slug, city: d.city, boundary: row.boundary, rentM2: names.rentM2 });
      return row;
    });
    await insertMany(tx, s.districts, districtRows);

    /* ---------- CMS ---------- */
    const cms: (typeof s.cmsPages.$inferInsert)[] = [];
    for (const bt of btRows) {
      const p = PERMITS[bt.slug];
      const items = p?.items ?? GENERIC_PERMITS;
      const title = p?.title ?? `${bt.nameKa} — საჭირო ნებართვები`;
      const body = [
        `# ${title}`,
        '',
        'ქვემოთ მოცემულია ჩეკლისტი. ყველა ნებართვის ვადა და მოსაკრებელი გადაამოწმეთ შესაბამის უწყებაში.',
        '',
        ...items.map(([what, where]) => `- [ ] **${what}** — ${where}`),
        '',
        '> ⚠️ დემო-ტექსტი. საბოლოო იურიდიული შინაარსი ადმინ-პანელიდან განახლდება.',
      ].join('\n');
      cms.push({ kind: 'permits', slug: bt.slug, businessTypeId: bt.id, title, bodyMd: body });
    }
    cms.push(
      {
        kind: 'static',
        slug: 'about',
        title: 'ჩვენ შესახებ',
        bodyMd:
          '# lokacia.ge\n\nსაქართველოს პირველი პორტალი მხოლოდ კომერციული ფართებისთვის. ფართს ბიზნესის თვალით ვაჩვენებთ: **იმუშავებს თუ არა ჩემი ბიზნესი აქ?**\n\n## რატომ lokacia\n\n- ფილტრები ბიზნესის ტიპის მიხედვით\n- ტექნიკური პასპორტი: სიმძლავრე, ჭერი, გამწოვი, აირი\n- ლოკაციის ანალიტიკა და ფასი რაიონის საშუალოსთან\n- ყველა განცხადება რეგულარულად დასტურდება\n',
      },
      {
        kind: 'static',
        slug: 'terms',
        title: 'მომსახურების პირობები',
        bodyMd: '# მომსახურების პირობები\n\n> ⚠️ დემო-ტექსტი — საბოლოო ვერსიას იურისტი ამზადებს (იხ. HUMAN_TODO).\n\n1. პლატფორმით სარგებლობა ნიშნავს ამ პირობების მიღებას.\n2. განცხადების ავტორი პასუხისმგებელია ინფორმაციის სიზუსტეზე.\n3. ტელეფონის ნომრის ჩვენება ფიქსირდება უსაფრთხოების მიზნით.\n',
      },
      {
        kind: 'static',
        slug: 'privacy',
        title: 'კონფიდენციალურობის პოლიტიკა',
        bodyMd: '# კონფიდენციალურობის პოლიტიკა\n\n> ⚠️ დემო-ტექსტი — საბოლოო ვერსიას იურისტი ამზადებს.\n\nპერსონალური მონაცემთა დაცვის შესახებ საქართველოს კანონის შესაბამისად:\n\n- ტელეფონის ნომერი ჩანს მხოლოდ „ნომრის ჩვენება“ ღილაკზე დაჭერის შემდეგ;\n- შეგიძლიათ ჩამოტვირთოთ ან წაშალოთ თქვენი მონაცემები პროფილიდან;\n- ყველა ჩვენება ჟურნალში ფიქსირდება.\n',
      },
      {
        kind: 'static',
        slug: 'pricing',
        title: 'ფასები',
        bodyMd: '# ფასები\n\nპირველი 3 თვე ყველა ფასიანი ფუნქცია **უფასოია**.\n',
      },
    );
    await insertMany(tx, s.cmsPages, cms);

    /* ---------- users & orgs ---------- */
    const users: (typeof s.users.$inferInsert)[] = [];
    const mkUser = (u: Partial<typeof s.users.$inferInsert> & { role: typeof s.users.$inferInsert['role'] }) => {
      const name = u.name ?? personName();
      const row = {
        id: newId(),
        name,
        verifiedAt: daysAgo(R.int(20, 400)),
        consentAt: daysAgo(R.int(20, 400)),
        createdAt: daysAgo(R.int(30, 500)),
        notificationPrefs: { listing_alert: ['in_app', 'email'], liveness: ['sms'], offers: ['in_app', 'sms'] },
        ...u,
      };
      users.push(row);
      return row;
    };
    const admin = mkUser({ role: 'admin', phone: DEMO_PHONES.admin, name: 'ადმინი ლოკაციაზე', email: 'admin@lokacia.ge' });
    const moderator = mkUser({ role: 'moderator', phone: DEMO_PHONES.moderator, name: 'ნინო მოდერატორი' });
    const demoOwner = mkUser({ role: 'user', phone: DEMO_PHONES.owner, name: 'გიორგი ბერიძე', email: 'owner@example.ge' });
    const demoTenant = mkUser({ role: 'user', phone: DEMO_PHONES.tenant, name: 'მარიამ ლომიძე', email: 'tenant@example.ge' });
    const demoProvider = mkUser({ role: 'user', phone: DEMO_PHONES.provider, name: 'ლევან კაპანაძე' });

    const owners = [demoOwner, ...Array.from({ length: 24 }, (_, i) => mkUser({ role: 'user', phone: fakePhone(i + 10) }))];
    const tenants = [demoTenant, ...Array.from({ length: 20 }, (_, i) => mkUser({ role: 'user', phone: fakePhone(i + 100) }))];

    type OrgSeed = { id: string; name: string; slug: string; type: 'agency' | 'developer' };
    const orgs: (typeof s.organizations.$inferInsert & OrgSeed)[] = [
      { id: newId(), name: 'ქალაქის ფართები', slug: 'city-spaces', type: 'agency', plan: 'agency', phone: '+995322000101', email: 'hello@cityspaces.ge', about: 'კომერციული უძრავი ქონების აგენტურა 2014 წლიდან. სპეციალიზაცია: HoReCa და რითეილი.', verified: true, brandColor: '#1E4A42', address: 'თბილისი, ჭავჭავაძის პრ. 37' },
      { id: newId(), name: 'ბიზნეს ლოკაცია', slug: 'business-lokacia', type: 'agency', plan: 'agency', phone: '+995322000202', email: 'info@bizloc.ge', about: 'ოფისები, საწყობები, ინდუსტრიული ფართები.', verified: true, brandColor: '#2F5FB8', address: 'თბილისი, წერეთლის პრ. 118' },
      { id: newId(), name: 'ფართი+', slug: 'parti-plus', type: 'agency', plan: 'broker', phone: '+995322000303', about: 'მცირე ბუტიკ-აგენტურა ძველ თბილისში.', verified: false, address: 'თბილისი, ლეონიძის ქ. 5' },
      { id: newId(), name: 'ახალი კვარტალი დეველოპმენტი', slug: 'akhali-kvartali', type: 'developer', plan: 'developer', phone: '+995322000404', about: 'საცხოვრებელ-კომერციული კომპლექსები თბილისსა და ბათუმში.', verified: true },
      { id: newId(), name: 'მთის ხედი ჯგუფი', slug: 'mtis-khedi', type: 'developer', plan: 'developer', phone: '+995322000505', about: 'მიქსდ-იუზ პროექტები, ქვედა ქანობების კომერციული ფართები.', verified: true },
    ];

    const memberships: (typeof s.memberships.$inferInsert)[] = [];
    const agents: { userId: string; orgId: string }[] = [];
    const agencyManager = mkUser({ role: 'agency_manager', phone: DEMO_PHONES.agencyManager, name: 'დავით გელაშვილი', slug: 'davit-gelashvili', bio: 'HoReCa ფართების ბროკერი, 10+ წლის გამოცდილება.' });
    const demoAgent = mkUser({ role: 'broker', phone: DEMO_PHONES.agent, name: 'ანა ჯავახიშვილი', slug: 'ana-javakhishvili', bio: 'რითეილ და ოფის ფართები ვაკე-საბურთალოზე.' });
    const assistant = mkUser({ role: 'agency_assistant', phone: DEMO_PHONES.assistant, name: 'სოფო ნოზაძე' });
    const agency2Manager = mkUser({ role: 'agency_manager', phone: DEMO_PHONES.agency2Manager, name: 'ზურაბ ქავთარაძე', slug: 'zurab-kavtaradze' });
    memberships.push(
      { orgId: orgs[0]!.id, userId: agencyManager.id, role: 'manager', acceptedAt: daysAgo(300) },
      { orgId: orgs[0]!.id, userId: demoAgent.id, role: 'agent', acceptedAt: daysAgo(250) },
      { orgId: orgs[0]!.id, userId: assistant.id, role: 'assistant', acceptedAt: daysAgo(100) },
      { orgId: orgs[1]!.id, userId: agency2Manager.id, role: 'manager', acceptedAt: daysAgo(280) },
      { orgId: orgs[0]!.id, invitedPhone: '+995599112233', role: 'agent' },
    );
    agents.push({ userId: agencyManager.id, orgId: orgs[0]!.id }, { userId: demoAgent.id, orgId: orgs[0]!.id }, { userId: agency2Manager.id, orgId: orgs[1]!.id });
    for (let i = 0; i < 9; i++) {
      const org = orgs[i % 3]!;
      const name = personName();
      const u = mkUser({ role: 'broker', phone: fakePhone(i + 300), name, slug: `${slugify(name)}-${i}`, bio: 'კომერციული ფართების ბროკერი.' });
      memberships.push({ orgId: org.id, userId: u.id, role: i % 3 === 2 && i > 5 ? 'manager' : 'agent', acceptedAt: daysAgo(R.int(20, 300)) });
      agents.push({ userId: u.id, orgId: org.id });
    }
    const developerUser = mkUser({ role: 'developer', phone: DEMO_PHONES.developer, name: 'ოთარ მეტრეველი' });
    memberships.push({ orgId: orgs[3]!.id, userId: developerUser.id, role: 'manager', acceptedAt: daysAgo(200) });
    const dev2 = mkUser({ role: 'developer', phone: fakePhone(900), name: 'ქეთევან აბაშიძე' });
    memberships.push({ orgId: orgs[4]!.id, userId: dev2.id, role: 'manager', acceptedAt: daysAgo(180) });

    const providerUsers = SERVICE_PROVIDERS.map((_, i) => (i === 0 ? demoProvider : mkUser({ role: 'user', phone: fakePhone(i + 600) })));

    await insertMany(tx, s.users, users);
    await insertMany(tx, s.organizations, orgs);
    await insertMany(tx, s.memberships, memberships);
    await insertMany(
      tx,
      s.tenantProfiles,
      tenants.map((t, i) => ({
        userId: t.id,
        activity: R.pick(['სპეშელტი ყავის ქსელი', 'სილამაზის სალონი', 'ტანსაცმლის ბრენდი', 'IT კომპანია', 'სტომატოლოგიური კლინიკა', 'საცხობი']),
        businessType: R.pick(['cafe', 'beauty-salon', 'retail', 'office', 'clinic', 'bakery']),
        companyName: i === 0 ? 'შპს „ყავის რუქა“' : `შპს „${R.pick(['ალფა', 'მზე', 'ნოვა', 'ბრიზი', 'ლაზური'])}“`,
        experienceYears: R.int(1, 15),
        desiredTermMonths: R.pick([12, 24, 36, 60]),
        employees: R.int(2, 60),
        about: 'გვინდა სტაბილური, ხანგრძლივი თანამშრომლობა ფართის მესაკუთრესთან.',
      })),
    );

    /* ---------- projects (off-plan, P8) ---------- */
    const byDistrict = Object.fromEntries(districts.map((d) => [d.slug, d]));
    const projects = [
      { org: orgs[3]!, name: 'კვარტალი ვაკე პარკ', district: 'vake', months: 10, floors: 14 },
      { org: orgs[3]!, name: 'ბათუმი ბიზნეს ჰაბი', district: 'new-boulevard', months: 16, floors: 22 },
      { org: orgs[4]!, name: 'დიღომი სიტი', district: 'didi-dighomi', months: 7, floors: 12 },
      { org: orgs[4]!, name: 'საბურთალო ქოლექშნ', district: 'saburtalo', months: 20, floors: 18 },
    ].map((p) => {
      const d = byDistrict[p.district]!;
      const [lat, lng] = pointIn(d.boundary);
      return {
        id: newId(),
        orgId: p.org.id,
        name: p.name,
        slug: slugify(p.name) || `project-${p.district}`,
        address: `${CITY_NAMES[d.city]}, ${R.pick(STREETS[p.district] ?? ['ქ.'])} ${R.int(1, 120)}`,
        districtId: d.id,
        completionDate: isoDate(daysFrom(p.months * 30)),
        description: 'მიქსდ-იუზ კომპლექსი: ქვედა ორი ქანობი — კომერციული ფართები, ცალკე შესასვლელებით და ფასადით.',
        floors: p.floors,
        coverUrl: `/api/v1/media/placeholder/facade/${slugify(p.name)}.svg`,
        lat,
        lng,
        createdBy: p.org.id,
      };
    });
    projects[0]!.slug = 'kvartali-vake-park';
    projects[1]!.slug = 'batumi-business-hub';
    projects[2]!.slug = 'dighomi-city';
    projects[3]!.slug = 'saburtalo-collection';
    await insertMany(
      tx,
      s.projects,
      projects.map(({ createdBy: _c, ...p }) => p),
    );

    /* ---------- listings ---------- */
    const tbilisiDistricts = districts.filter((d) => d.city === 'tbilisi');
    const regionDistricts = districts.filter((d) => d.city !== 'tbilisi');
    const btWeights: [string, number][] = [
      ['cafe', 14], ['retail', 14], ['office', 16], ['warehouse', 8], ['beauty-salon', 6], ['pharmacy', 4], ['bar', 4],
      ['bakery', 3], ['clinic', 4], ['coworking', 3], ['production', 4], ['showroom', 4], ['car-service', 4], ['fitness', 3],
      ['education', 3], ['pop-up', 2],
    ];
    const totalW = btWeights.reduce((a, [, w]) => a + w, 0);
    const pickBt = () => {
      let r = R.next() * totalW;
      for (const [slug, w] of btWeights) if ((r -= w) <= 0) return slug;
      return 'office';
    };

    const listings: (typeof s.listings.$inferInsert)[] = [];
    const passports: (typeof s.spacePassports.$inferInsert)[] = [];
    const media: (typeof s.listingMedia.$inferInsert)[] = [];
    const history: (typeof s.listingHistory.$inferInsert)[] = [];
    const equipment: (typeof s.transferEquipment.$inferInsert)[] = [];
    const slots: (typeof s.availabilitySlots.$inferInsert)[] = [];
    const liveness: (typeof s.livenessChecks.$inferInsert)[] = [];
    const verifications: (typeof s.ownerVerifications.$inferInsert)[] = [];
    const usedSlugs = new Set<string>();

    for (let i = 0; i < LISTING_COUNT; i++) {
      const inRegion = i % 11 === 10;
      const district = inRegion ? R.pick(regionDistricts) : R.pick(tbilisiDistricts);
      const primary = pickBt();
      const bt = BUSINESS_TYPE_BY_SLUG[primary]!;
      const extra = R.chance(0.35) ? R.pick(BUSINESS_TYPES.filter((t) => t.slug !== primary)).slug : null;
      const businessTypes = extra ? [primary, extra] : [primary];

      const isOffPlan = i % 37 === 5;
      const project = isOffPlan ? R.pick(projects) : null;
      const dealRoll = R.next();
      let dealType: DealType = dealRoll < 0.68 ? 'rent' : dealRoll < 0.84 ? 'sale' : dealRoll < 0.93 ? 'transfer' : 'short_term';
      if (isOffPlan) dealType = R.chance(0.5) ? 'sale' : 'rent';
      if (primary === 'pop-up') dealType = 'short_term';

      const large = ['warehouse', 'production', 'fitness', 'showroom', 'car-service'].includes(primary);
      const area = large ? R.int(120, 1800) : primary === 'office' || primary === 'coworking' ? R.int(35, 600) : R.int(18, 260);
      const widthM = Number(Math.max(3, Math.sqrt(area) * R.float(0.6, 1.1)).toFixed(1));
      const depthM = Number((area / widthM).toFixed(1));
      const typeFactor = large ? 0.35 : primary === 'office' ? 0.8 : 1;
      const rentM2 = district.rentM2 * typeFactor * R.float(0.75, 1.3);
      let priceMinor = Math.round((area * rentM2) / 10) * 1000;
      let pricePeriod: 'month' | 'total' = 'month';
      if (dealType === 'sale' || dealType === 'transfer') {
        priceMinor = Math.round((area * rentM2 * R.int(95, 140)) / 1000) * 100_000;
        pricePeriod = 'total';
      }
      if (dealType === 'transfer') priceMinor = Math.round(priceMinor * 0.2 / 100_000) * 100_000 + 2_000_000;

      const agent = R.chance(0.45) ? R.pick(agents) : null;
      const owner = R.pick(owners);
      const statusRoll = R.next();
      let status: ListingStatus =
        statusRoll < 0.8 ? 'active' : statusRoll < 0.86 ? 'stale' : statusRoll < 0.9 ? 'pending_review' : statusRoll < 0.93 ? 'rented' : statusRoll < 0.95 ? 'draft' : statusRoll < 0.97 ? 'archived' : statusRoll < 0.985 ? 'rejected' : 'sold';
      if (status === 'sold' && dealType !== 'sale') status = 'rented';
      // demo accounts always have a healthy mix
      const ownerId = i < 12 ? demoOwner.id : agent ? agent.userId : owner.id;
      if (i < 12) status = (['active', 'active', 'active', 'pending_review', 'stale', 'draft', 'active', 'rented', 'active', 'rejected', 'active', 'active'] as ListingStatus[])[i]!;
      const isAgentListing = i >= 12 && !!agent;

      const [lat, lng] = project ? [project.lat + R.float(-0.0004, 0.0004, 6), project.lng + R.float(-0.0004, 0.0004, 6)] : pointIn(district.boundary);
      const street = R.pick(STREETS[district.slug] ?? ['ქ.']);
      const address = `${CITY_NAMES[district.city]}, ${street} ${R.int(1, 150)}`;
      const titleBase = R.pick(TITLE_PATTERNS[primary] ?? ['კომერციული ფართი']);
      const title = `${titleBase}, ${area} მ² — ${DISTRICT_NAMES[district.slug]!.ka}`;
      let slug = `${slugify(`${bt.nameEn} ${area}m2 ${district.slug}`)}-${i + 1}`;
      while (usedSlugs.has(slug)) slug += 'x';
      usedSlugs.add(slug);

      const created = daysAgo(R.int(1, 240));
      const id = newId();
      const vip = status === 'active' && R.chance(0.08);
      const description = [
        R.pick(DESCRIPTION_SENTENCES.intro),
        R.pick(DESCRIPTION_SENTENCES.condition),
        `ფართი ${area} მ², ${R.chance(0.7) ? 'პირველი' : R.pick(['მეორე', 'მიწისქვეშა', 'მესამე'])} ქანობი.`,
        dealType === 'rent' ? R.pick(DESCRIPTION_SENTENCES.terms) : '',
        dealType === 'transfer' ? 'გადაცემა მოიცავს ყველა აღჭურვილობას და ლიცენზიებს. ფართის ფასი და აღჭურვილობის ფასი ცალკე მითითებულია.' : '',
      ]
        .filter(Boolean)
        .join(' ');

      listings.push({
        id,
        orgId: isAgentListing ? agent!.orgId : project ? project.orgId : null,
        ownerId: project ? (project.orgId === orgs[3]!.id ? developerUser.id : dev2.id) : ownerId,
        agentId: isAgentListing ? agent!.userId : null,
        projectId: project?.id ?? null,
        slug,
        businessTypes,
        dealType,
        priceMinor,
        pricePeriod,
        priceDayMinor: dealType === 'short_term' ? Math.round(priceMinor / 22 / 100) * 100 : null,
        priceHourMinor: dealType === 'short_term' && ['cafe', 'bakery', 'coworking', 'pop-up'].includes(primary) ? Math.round(priceMinor / 180 / 100) * 100 : null,
        serviceFeeMinor: primary === 'office' ? Math.round(area * 3) * 100 : R.chance(0.3) ? R.int(5, 30) * 1000 : 0,
        depositMonths: R.pick([1, 1, 2, 3]),
        utilitiesIncluded: R.chance(0.1),
        equipmentPriceMinor: dealType === 'transfer' ? R.int(8, 60) * 100_000 : null,
        areaM2: area,
        floor: R.chance(0.7) ? 1 : R.pick([-1, 0, 2, 3, 5]),
        floorsTotal: R.int(2, 16),
        commissionPct: isAgentListing ? R.pick([50, 100]) === 50 ? 50 : 100 : null,
        isOwner: !isAgentListing,
        verifiedOwner: !isAgentListing && R.chance(0.4),
        status,
        rejectReason: status === 'rejected' ? 'ფოტოები არ შეესაბამება ფართს. გთხოვთ ატვირთოთ რეალური ფოტოები.' : null,
        lastConfirmedAt: ['active', 'rented', 'sold'].includes(status) ? daysAgo(R.int(0, 12)) : status === 'stale' ? daysAgo(R.int(15, 30)) : null,
        publishedAt: ['active', 'stale', 'rented', 'sold', 'archived'].includes(status) ? created : null,
        completionDate: project?.completionDate ?? null,
        districtId: district.id,
        city: district.city,
        address,
        title,
        titleEn: `${bt.nameEn} space, ${area} m² — ${DISTRICT_NAMES[district.slug]!.en}`,
        titleRu: `${bt.nameRu}, ${area} м² — ${DISTRICT_NAMES[district.slug]!.ru}`,
        description,
        descriptionEn: `Commercial space of ${area} m² in ${DISTRICT_NAMES[district.slug]!.en}, suitable for ${bt.nameEn.toLowerCase()}.`,
        descriptionRu: `Коммерческое помещение ${area} м² в районе ${DISTRICT_NAMES[district.slug]!.ru}, подходит под ${bt.nameRu.toLowerCase()}.`,
        vipUntil: vip ? daysFrom(R.int(2, 25)) : null,
        videoUrl: R.chance(0.15) ? 'https://meet.jit.si/lokacia-demo-viewing' : null,
        tourUrl: R.chance(0.1) ? `/api/v1/media/placeholder/pano/${id}.svg` : null,
        lat,
        lng,
        createdAt: created,
        updatedAt: created,
      });

      const isHoreca = ['cafe', 'bar', 'bakery'].includes(primary);
      passports.push({
        listingId: id,
        powerKw: large ? R.int(30, 250) : R.int(5, 60),
        threePhase: large || isHoreca ? R.chance(0.8) : R.chance(0.3),
        ceilingM: large ? R.float(4, 10, 1) : R.float(2.6, 4.5, 1),
        facadeM: large ? R.float(6, 40, 1) : R.float(2, 18, 1),
        widthM,
        depthM,
        hasHood: isHoreca ? R.chance(0.75) : R.chance(0.1),
        hasGas: isHoreca ? R.chance(0.7) : R.chance(0.2),
        wetPoints: R.int(isHoreca || primary === 'beauty-salon' || primary === 'clinic' ? 2 : 0, isHoreca ? 6 : 4),
        gateWM: large ? R.float(2.5, 6, 1) : null,
        truckAccess: large ? R.chance(0.8) : false,
        access247: R.chance(0.45),
        parking: R.int(0, large ? 30 : 8),
        shopWindow: ['retail', 'pharmacy', 'showroom', 'cafe', 'bakery', 'pop-up'].includes(primary) ? R.chance(0.85) : R.chance(0.2),
        separateEntrance: R.chance(0.6),
        ventilation: R.chance(0.5),
        outline: R.chance(0.2)
          ? [[0, 0], [widthM, 0], [widthM, depthM * 0.6], [widthM * 0.65, depthM * 0.6], [widthM * 0.65, depthM], [0, depthM]]
          : null,
      });

      const photoCount = status === 'draft' ? R.int(0, 2) : R.int(3, 9);
      for (let p = 0; p < photoCount; p++) {
        media.push({
          listingId: id,
          kind: 'photo',
          url: `/api/v1/media/placeholder/${R.pick(['interior', 'interior', 'facade', 'street', 'detail'])}/${id.slice(-8)}-${p}.svg`,
          sort: p,
          width: 1600,
          height: 1067,
          status: 'ready',
          alt: `${title} — ფოტო ${p + 1}`,
        });
      }
      if (R.chance(0.7)) media.push({ listingId: id, kind: 'plan', url: `/api/v1/media/placeholder/plan/${id.slice(-8)}.svg`, sort: 100, isFloorplan: true, status: 'ready', alt: 'ნახაზი' });
      if (R.chance(0.08)) media.push({ listingId: id, kind: 'pano360', url: `/api/v1/media/placeholder/pano/${id.slice(-8)}.svg`, sort: 101, status: 'ready', alt: '360° ფოტო' });

      // Space history (P10) — some spaces with frequent closures
      const histN = R.chance(0.45) ? R.int(1, i % 9 === 0 ? 4 : 2) : 0;
      let end = daysAgo(R.int(10, 90));
      for (let h = 0; h < histN; h++) {
        const [bname, btype] = R.pick(HISTORY_BUSINESSES);
        const start = new Date(end.getTime() - R.int(120, i % 9 === 0 ? 300 : 1400) * DAY);
        history.push({ listingId: id, businessName: bname, businessType: btype, startedAt: isoDate(start), endedAt: isoDate(end), note: h === 0 && R.chance(0.3) ? 'გადავიდა უფრო დიდ ფართზე' : null });
        end = new Date(start.getTime() - R.int(20, 120) * DAY);
      }

      if (dealType === 'transfer') {
        for (const [name, price] of R.sample(EQUIPMENT, R.int(3, 7))) equipment.push({ listingId: id, name, qty: R.int(1, 3), priceMinor: price });
      }

      if (status === 'active') {
        // viewing & short-term slots for the next 2 weeks
        for (let d = 1; d <= 14; d++) {
          if (!R.chance(dealType === 'short_term' ? 0.9 : 0.25)) continue;
          const start = daysFrom(d);
          start.setHours(R.pick([10, 11, 12, 15, 16, 17]), 0, 0, 0);
          const kind = dealType === 'short_term' ? 'short_term' : 'viewing';
          const endAt = new Date(start.getTime() + (kind === 'viewing' ? 30 * 60_000 : 8 * 3_600_000));
          slots.push({ listingId: id, kind, startsAt: start, endsAt: endAt, priceMinor: kind === 'short_term' ? (listings.at(-1)!.priceDayMinor ?? null) : null });
        }
        const sent = daysAgo(R.int(0, 11));
        liveness.push({ listingId: id, channel: R.pick(['sms', 'telegram', 'email']), token: token(), sentAt: sent, expiresAt: new Date(sent.getTime() + 72 * 3_600_000), confirmedAt: new Date(sent.getTime() + R.int(1, 30) * 3_600_000), result: 'confirmed' });
      }
      if (status === 'stale') {
        const sent = daysAgo(R.int(4, 10));
        liveness.push({ listingId: id, channel: 'sms', token: token(), sentAt: sent, expiresAt: new Date(sent.getTime() + 72 * 3_600_000), result: 'expired' });
      }
      if (!isAgentListing && !project && R.chance(0.12)) {
        verifications.push({ listingId: id, userId: ownerId, documentUrl: `/api/v1/media/placeholder/document/${id.slice(-8)}.svg`, status: R.chance(0.5) ? 'pending' : 'approved', reviewedBy: null, note: null });
      }
    }
    // Make approved verifications consistent with badge
    const approved = new Set(verifications.filter((v) => v.status === 'approved').map((v) => v.listingId));
    for (const l of listings) if (approved.has(l.id!)) l.verifiedOwner = true;
    for (const v of verifications) if (v.status === 'approved') v.reviewedBy = moderator.id;

    await insertMany(tx, s.listings, listings);
    await insertMany(tx, s.spacePassports, passports);
    await insertMany(tx, s.listingMedia, media, 1000);
    await insertMany(tx, s.listingHistory, history);
    await insertMany(tx, s.transferEquipment, equipment);
    await insertMany(tx, s.availabilitySlots, slots, 1000);
    await insertMany(tx, s.livenessChecks, liveness);
    await insertMany(tx, s.ownerVerifications, verifications);

    const active = listings.filter((l) => l.status === 'active');

    /* ---------- POIs (fake OSM-like; real import: apps/api/scripts/import-osm) ---------- */
    const pois: (typeof s.pois.$inferInsert)[] = [];
    let poiN = 0;
    for (const d of districts) {
      const density = d.city === 'tbilisi' ? 1 : 0.4;
      for (const bt of BUSINESS_TYPES) {
        const n = Math.round(R.int(2, 7) * density);
        for (let k = 0; k < n; k++) {
          const [lat, lng] = pointIn(d.boundary);
          pois.push({ category: 'competitor', businessType: bt.slug, name: `${R.pick(COMPETITOR_NAMES[bt.slug] ?? ['ბიზნესი'])} „${R.pick(['ლილე', 'ორბი', 'ქვევრი', 'ნუში', 'ფიქალი', 'ტყემალი', 'ალვა', 'კვარცი'])}“`, source: 'demo', sourceId: `c${poiN++}`, lat, lng });
        }
      }
      const cats: [typeof s.pois.$inferInsert['category'], number, string[]][] = [
        ['transport', 12, ['ავტობუსის გაჩერება', 'მეტროს სადგური', 'მიკროავტობუსის გაჩერება']],
        ['school', 4, ['საჯარო სკოლა №', 'კერძო სკოლა „განთიადი“ №', 'საბავშვო ბაღი №']],
        ['business_center', 3, ['ბიზნეს-ცენტრი „', 'ოფის-პარკი „']],
        ['parking', 4, ['ავტოსადგომი №']],
        ['bank', 4, ['ბანკის ფილიალი №']],
      ];
      for (const [category, n, names] of cats) {
        for (let k = 0; k < Math.round(n * density); k++) {
          const [lat, lng] = pointIn(d.boundary);
          let name = R.pick(names);
          name = name.endsWith('„') ? `${name}${R.pick(['ტაუერ', 'პლაზა', 'სიტი', 'ჰაბ'])}“` : name.endsWith('№') ? `${name}${R.int(1, 220)}` : name;
          pois.push({ category, name, source: 'demo', sourceId: `p${poiN++}`, lat, lng });
        }
      }
    }
    await insertMany(tx, s.pois, pois, 1000);

    /* ---------- engagement ---------- */
    const favorites: (typeof s.favorites.$inferInsert)[] = [];
    for (const t of tenants) for (const l of R.sample(active, R.int(2, 9))) favorites.push({ userId: t.id!, listingId: l.id! });
    await insertMany(tx, s.favorites, favorites);

    const cafeActive = active.filter((l) => l.businessTypes!.includes('cafe')).slice(0, 4);
    await insertMany(tx, s.compareLists, [
      { userId: demoTenant.id!, name: 'კაფე — საბოლოო 4', listingIds: cafeActive.map((l) => l.id!), shareToken: 'demo-compare-cafe' },
    ]);

    await insertMany(tx, s.savedSearches, [
      { userId: demoTenant.id!, name: 'კაფე ვაკეში 3 000 ₾-მდე', query: { businessType: 'cafe', dealType: 'rent', districts: ['vake'], priceMax: 3000 }, channels: ['in_app', 'email', 'telegram'], unsubscribeToken: token(), lastNotifiedAt: daysAgo(2) },
      { userId: demoTenant.id!, name: 'საწყობი 300+ მ²', query: { businessType: 'warehouse', areaMin: 300, truckAccess: true }, channels: ['in_app', 'viber'], unsubscribeToken: token() },
      ...tenants.slice(1, 8).map((t) => ({ userId: t.id!, name: 'ოფისი საბურთალოზე', query: { businessType: 'office', districts: ['saburtalo'] }, channels: ['email'], unsubscribeToken: token() })),
    ]);

    const tbilisiIds = tbilisiDistricts.map((d) => d.id);
    await insertMany(
      tx,
      s.demandRequests,
      DEMAND_TITLES.flatMap(([title, bt], k) =>
        [0, 1].map((rep) => ({
          userId: (rep === 0 && k === 0 ? demoTenant : R.pick(tenants)).id!,
          businessType: bt,
          dealType: 'rent' as const,
          title: rep ? `${title} (${R.pick(['სასწრაფო', 'ხანგრძლივი ვადით', 'ბიუჯეტი მოქნილია'])})` : title,
          description: 'ხანგრძლივი იჯარა, 3+ წელი. ვეძებ მესაკუთრეების და ბროკერების შეთავაზებებს.',
          areaMin: bt === 'warehouse' ? 300 : R.int(30, 80),
          areaMax: bt === 'warehouse' ? 800 : R.int(90, 220),
          budgetMinor: R.int(15, 90) * 10_000,
          districtIds: R.sample(tbilisiIds, R.int(1, 3)),
          contactPhone: fakePhone(k + 700),
          expiresAt: rep && k % 3 === 0 ? daysAgo(3) : daysFrom(R.int(5, 30)),
          status: rep && k % 3 === 0 ? ('expired' as const) : ('active' as const),
          createdAt: daysAgo(R.int(1, 25)),
        })),
      ),
    );

    // events & daily aggregates (P19) for 30 days
    const statsDaily: (typeof s.listingStatsDaily.$inferInsert)[] = [];
    const events: (typeof s.listingEvents.$inferInsert)[] = [];
    for (const l of listings.filter((x) => ['active', 'stale', 'rented'].includes(x.status!))) {
      const popularity = R.float(0.3, 3);
      for (let d = 0; d < 30; d++) {
        const views = Math.round(R.int(0, 25) * popularity * (l.vipUntil ? 2.5 : 1));
        if (!views) continue;
        statsDaily.push({ listingId: l.id!, day: isoDate(daysAgo(d)), views, reveals: Math.round(views * R.float(0, 0.15)), saves: Math.round(views * R.float(0, 0.08)), shares: R.chance(0.1) ? 1 : 0 });
      }
    }
    for (const l of listings.filter((x) => x.ownerId === demoOwner.id)) {
      for (let k = 0; k < 60; k++) {
        events.push({ listingId: l.id!, type: R.pick(['view', 'view', 'view', 'view', 'reveal', 'save']), ipHash: sha(`ip${k % 17}`), at: new Date(NOW.getTime() - R.int(0, 6 * 3600) * 1000) });
      }
    }
    await insertMany(tx, s.listingStatsDaily, statsDaily, 2000);
    await insertMany(tx, s.listingEvents, events, 2000);

    /* ---------- transactions: viewings, offers, chat ---------- */
    const demoOwnerActive = listings.filter((l) => l.ownerId === demoOwner.id && l.status === 'active');
    const target = demoOwnerActive[0]!;
    const target2 = demoOwnerActive[1] ?? target;
    const viewings: (typeof s.viewings.$inferInsert)[] = [
      { listingId: target.id!, userId: demoTenant.id!, startsAt: daysFrom(2), endsAt: new Date(daysFrom(2).getTime() + 1_800_000), mode: 'onsite', status: 'confirmed', note: 'მოვალ პარტნიორთან ერთად' },
      { listingId: target2.id!, userId: demoTenant.id!, startsAt: daysFrom(4), endsAt: new Date(daysFrom(4).getTime() + 1_800_000), mode: 'video', status: 'confirmed', videoUrl: 'https://meet.jit.si/lokacia-demo-viewing' },
      { listingId: target.id!, userId: tenants[3]!.id!, startsAt: daysAgo(5), endsAt: new Date(daysAgo(5).getTime() + 1_800_000), mode: 'onsite', status: 'done' },
    ];
    await insertMany(tx, s.viewings, viewings);

    const rootOffer = newId();
    const counter = newId();
    const accepted = newId();
    await insertMany(tx, s.offers, [
      { id: rootOffer, listingId: target.id!, fromUserId: demoTenant.id!, toUserId: demoOwner.id!, rootOfferId: rootOffer, priceMinor: Math.round(target.priceMinor! * 0.85), termMonths: 36, freeMonths: 3, indexationPct: 0, fitoutPaidBy: 'owner', message: 'გვინდა 3 წლით. მოწყობისთვის 3 უფასო თვე გვჭირდება.', status: 'countered', createdAt: daysAgo(4) },
      { id: counter, listingId: target.id!, fromUserId: demoOwner.id!, toUserId: demoTenant.id!, parentOfferId: rootOffer, rootOfferId: rootOffer, priceMinor: Math.round(target.priceMinor! * 0.93), termMonths: 36, freeMonths: 2, indexationPct: 3, fitoutPaidBy: 'tenant', message: 'შემიძლია 2 უფასო თვე, ყოველწლიური ინდექსაცია 3%.', status: 'pending', createdAt: daysAgo(3) },
      { id: accepted, listingId: target2.id!, fromUserId: tenants[2]!.id!, toUserId: demoOwner.id!, rootOfferId: accepted, priceMinor: target2.priceMinor!, termMonths: 24, freeMonths: 1, fitoutPaidBy: 'shared', message: 'ფასი მისაღებია.', status: 'accepted', createdAt: daysAgo(12) },
    ]);

    const convId = newId();
    await insertMany(tx, s.conversations, [
      { id: convId, listingId: target.id!, participantIds: [demoTenant.id!, demoOwner.id!], channel: 'portal', subject: target.title, lastMessageAt: daysAgo(1) },
    ]);
    await insertMany(tx, s.messages, [
      { conversationId: convId, senderId: demoTenant.id!, body: 'გამარჯობა! ფართი ისევ თავისუფალია?', createdAt: daysAgo(6), readAt: daysAgo(6) },
      { conversationId: convId, senderId: demoOwner.id!, body: 'გამარჯობა, კი. გამწოვი და აირი ყვაცლია.', createdAt: daysAgo(6), readAt: daysAgo(5) },
      { conversationId: convId, senderId: demoTenant.id!, body: 'სიმძლავრე რამდენია? ესპრესო-აპარატისთვის 3 ფაზა გვჭირდება.', createdAt: daysAgo(5), readAt: daysAgo(5) },
      { conversationId: convId, senderId: demoOwner.id!, body: 'სამფაზა კვება არის, 25 კვტ. ორშაბათს შეგიძლიათ ნახოთ.', createdAt: daysAgo(1) },
    ]);

    /* ---------- services marketplace (P24) ---------- */
    const providers = SERVICE_PROVIDERS.map((p, i) => ({
      id: newId(),
      userId: providerUsers[i]!.id!,
      name: p.name,
      slug: slugify(p.name) || `provider-${i}`,
      categories: p.categories,
      about: p.about,
      phone: fakePhone(i + 800),
      city: i % 5 === 4 ? 'batumi' : 'tbilisi',
      priceFrom: R.pick(['150 ₾/მ²-დან', 'შეთანხმებით', '500 ₾-დან', '80 ₾/სთ']),
      rating: R.int(38, 50),
      reviewsCount: R.int(3, 40),
      verified: R.chance(0.6),
      portfolio: [1, 2, 3].map((n) => `/api/v1/media/placeholder/interior/provider-${i}-${n}.svg`),
    }));
    providers[0]!.slug = 'motsqoba-plus';
    await insertMany(tx, s.serviceProviders, providers);
    const orders: (typeof s.serviceOrders.$inferInsert)[] = [];
    for (let k = 0; k < 24; k++) {
      const p = k < 4 ? providers[0]! : R.pick(providers);
      const st = R.pick(['requested', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled'] as const);
      const quote = ['quoted', 'accepted', 'in_progress', 'completed'].includes(st) ? R.int(20, 400) * 10_000 : null;
      orders.push({
        providerId: p.id,
        requesterId: (k < 3 ? demoTenant : R.pick(tenants)).id!,
        listingId: R.pick(active).id!,
        category: p.categories[0]!,
        description: R.pick(['80 მ² კაფეს სრული მოწყობა, 6 კვირაში.', 'ფასადის აბრა ნეონით, 4 მ.', 'ესპრესო-ბარის აღჭურვილობის კომპლექტი.', 'იჯარის ხელშეკრულების გადამოწმება.']),
        status: st,
        quoteMinor: quote,
        quoteNote: quote ? 'ფასი მოიცავს მასალას და მონტაჟს.' : null,
        amountMinor: st === 'completed' ? quote : null,
        commissionPct: 10,
        commissionMinor: st === 'completed' && quote ? Math.round(quote * 0.1) : null,
        completedAt: st === 'completed' ? daysAgo(R.int(1, 60)) : null,
      });
    }
    await insertMany(tx, s.serviceOrders, orders);
    const reviews: (typeof s.reviews.$inferInsert)[] = [];
    for (const p of providers) for (let k = 0; k < 3; k++) reviews.push({ targetType: 'provider', targetId: p.id, authorName: personName(), rating: R.int(4, 5), body: R.pick(REVIEW_TEXTS) });
    for (const a of agents) for (let k = 0; k < R.int(1, 5); k++) reviews.push({ targetType: 'broker', targetId: a.userId, authorName: personName(), rating: R.int(3, 5), body: R.pick(REVIEW_TEXTS) });
    await insertMany(tx, s.reviews, reviews);

    /* ---------- notifications ---------- */
    await insertMany(tx, s.notifications, [
      { userId: demoOwner.id!, channel: 'in_app', template: 'offer_received', title: 'ახალი შეთავაზება', body: `${target.title} — ახალი ფასის შეთავაზება`, link: `/account/offers`, status: 'sent', sentAt: daysAgo(4) },
      { userId: demoOwner.id!, channel: 'in_app', template: 'liveness', title: 'დაადასტურეთ ფართის სტატუსი', body: 'ფართი ისევ თავისუფალია? ერთი დაჭერა.', link: '/account/listings', status: 'sent', sentAt: daysAgo(1) },
      { userId: demoTenant.id!, channel: 'in_app', template: 'listing_alert', title: 'ახალი ფართი თქვენი ძებნით', body: 'კაფე ვაკეში 3 000 ₾-მდე — 2 ახალი ფართი', link: '/search?businessType=cafe&districts=vake&priceMax=3000', status: 'sent', sentAt: daysAgo(2) },
      { userId: demoTenant.id!, channel: 'in_app', template: 'offer_countered', title: 'კონტრ-შეთავაზება', body: 'მესაკუთრემ გამოგზავნა კონტრ-შეთავაზება', link: '/account/offers', status: 'sent', sentAt: daysAgo(3) },
    ]);

    await insertMany(tx, s.feedback, [
      { app: 'web', path: '/search', rating: 5, message: 'ფილტრი ბიზნესის ტიპის მიხედვით — სუპერ!', status: 'new' },
      { app: 'crm', path: '/deals', rating: 4, message: 'დღის მარშრუტის ოპტიმიზაცია ძალიან დამეხმარა.', status: 'seen' },
    ]);

    /* ---------- CRM, billing, v2 ---------- */
    await seedCrm(tx, { R, orgs, agents, listings, districts, demoTenant, NOW });
    await seedBilling(tx, { R, orgs, users, listings, districts, demoOwner, demoTenant, NOW, target2, providers, pois });

    console.log(
      `seeded: ${users.length} users, ${orgs.length} orgs, ${listings.length} listings, ${media.length} media, ${pois.length} pois in ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  });

  // district stats (avg price, counts) computed from seeded listings
  await db.execute(sql`
    UPDATE districts d SET
      avg_price_m2_minor = COALESCE(sub.avg_rent, d.avg_price_m2_minor),
      active_count = COALESCE(sub.active, 0),
      vacancy_count = COALESCE(sub.vacancy, 0)
    FROM (
      SELECT district_id,
        round(avg(price_minor / NULLIF(area_m2, 0)) FILTER (WHERE deal_type = 'rent'))::int AS avg_rent,
        count(*) FILTER (WHERE status = 'active')::int AS active,
        count(*) FILTER (WHERE status IN ('active', 'stale') AND deal_type IN ('rent', 'short_term'))::int AS vacancy
      FROM listings WHERE deleted_at IS NULL GROUP BY district_id
    ) sub WHERE sub.district_id = d.id`);
  await db.execute(sql`UPDATE listings l SET location_score = ls.score FROM location_scores ls WHERE ls.listing_id = l.id AND ls.business_type = l.business_types[1]`);

  await client.end();
}

if (require.main === module) {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { SERVICE_CATEGORIES };
