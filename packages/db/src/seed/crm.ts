import { randomBytes } from 'node:crypto';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Tx } from '../client';
import * as s from '../schema/index';
import { newId } from '../schema/_common';
import { FIRST_NAMES, LAST_NAMES, type Rng } from './content';

const DAY = 86_400_000;

export const DEFAULT_STAGES: s.PipelineStage[] = [
  { key: 'lead', name: 'ლიდი', kind: 'open' },
  { key: 'viewing', name: 'ჩვენება', kind: 'open' },
  { key: 'offer', name: 'შეთავაზება', kind: 'open' },
  { key: 'contract', name: 'ხელშეკრულება', kind: 'open' },
  { key: 'won', name: 'მოგებული', kind: 'won' },
  { key: 'lost', name: 'წაგებული', kind: 'lost' },
];

async function insertMany<T extends PgTable>(tx: Tx, table: T, rows: T['$inferInsert'][], chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await tx.insert(table).values(rows.slice(i, i + chunk) as any);
  }
}

type Ctx = {
  R: Rng;
  orgs: { id: string; type: 'agency' | 'developer'; slug: string; name: string }[];
  agents: { userId: string; orgId: string }[];
  listings: (typeof s.listings.$inferInsert)[];
  districts: { id: string; slug: string; city: string }[];
  demoTenant: { id?: string };
  NOW: Date;
};

export async function seedCrm(tx: Tx, { R, orgs, agents, listings, districts, NOW }: Ctx) {
  const at = (days: number) => new Date(NOW.getTime() + days * DAY);
  const sources = [
    ['lokacia', 'lokacia.ge', 29000],
    ['facebook', 'Facebook რეკლამა', 120000],
    ['instagram', 'Instagram', 80000],
    ['referral', 'რეკომენდაცია', 0],
    ['cold_call', 'ცივი ზარი', 20000],
    ['website', 'ვებ-საიტი', 15000],
  ] as const;

  for (const org of orgs.filter((o) => o.type === 'agency')) {
    const orgAgents = agents.filter((a) => a.orgId === org.id).map((a) => a.userId);
    const orgListings = listings.filter((l) => l.orgId === org.id);
    const anyListings = listings.filter((l) => l.status === 'active');
    const pipelineId = newId();
    await insertMany(tx, s.crmPipelines, [{ id: pipelineId, orgId: org.id, name: 'ძირითადი', stages: DEFAULT_STAGES, isDefault: true }]);
    await insertMany(
      tx,
      s.crmLeadSources,
      sources.map(([key, name, cost]) => ({ orgId: org.id, key, name, monthlyCostMinor: cost })),
    );

    const contacts: (typeof s.crmContacts.$inferInsert)[] = [];
    const n = org.slug === 'city-spaces' ? 90 : 40;
    for (let i = 0; i < n; i++) {
      const type = i % 5 === 0 ? 'owner' : i % 13 === 0 ? 'partner' : 'client';
      const name = `${R.pick(FIRST_NAMES)} ${R.pick(LAST_NAMES)}`;
      const phoneDigits = `5${R.int(50, 99)}${String(R.int(100000, 999999))}`;
      contacts.push({
        id: newId(),
        orgId: org.id,
        type,
        name,
        company: R.chance(0.4) ? `შპს „${R.pick(['ალფა', 'ორბი', 'ტყემალი', 'ნოვა', 'ფიქალი', 'ბრიზი'])}“` : null,
        // Some intentionally messy duplicates for the dedup/merge demo (C1)
        phones: [i % 17 === 3 ? `${phoneDigits.slice(0, 3)} ${phoneDigits.slice(3)}` : `+995${phoneDigits}`],
        emails: R.chance(0.5) ? [`client${i}@example.ge`] : [],
        tags: R.sample(['VIP', 'HoReCa', 'რითეილი', 'ოფისი', 'სასწრაფო', 'ინვესტორი'], R.int(0, 2)),
        source: R.pick(sources)[0],
        requirements:
          type === 'client'
            ? {
                businessType: R.pick(['cafe', 'retail', 'office', 'warehouse', 'beauty-salon', 'pharmacy']),
                dealType: 'rent',
                areaMin: R.int(30, 80),
                areaMax: R.int(90, 300),
                budgetMaxMinor: R.int(15, 120) * 10_000,
                districtIds: R.sample(districts.filter((d) => d.city === 'tbilisi').map((d) => d.id), R.int(1, 3)),
              }
            : null,
        ownerAgentId: R.pick(orgAgents),
        notes: R.chance(0.3) ? 'ზარის შემდეგ — ლოდინში ბიუჯეტის დადასტურებაზე.' : null,
        portalToken: randomBytes(12).toString('base64url'),
        lastContactedAt: new Date(NOW.getTime() - R.int(0, 40) * DAY),
        createdAt: new Date(NOW.getTime() - R.int(1, 200) * DAY),
      });
    }
    // exact duplicates (same person typed twice)
    for (let k = 0; k < 3; k++) {
      const orig = contacts[k * 7 + 1]!;
      contacts.push({ ...orig, id: newId(), name: orig.name!.split(' ')[0] + ' ' + orig.name!.split(' ')[1]!.slice(0, -1), phones: [orig.phones![0]!.replace('+995', '0')], portalToken: randomBytes(12).toString('base64url') });
    }
    if (org.slug === 'city-spaces') contacts[1]!.portalToken = 'demo-client-portal';
    await insertMany(tx, s.crmContacts, contacts);

    const clients = contacts.filter((c) => c.type === 'client');
    const deals: (typeof s.crmDeals.$inferInsert)[] = [];
    const stageKeys = DEFAULT_STAGES.map((st) => st.key);
    clients.slice(0, Math.min(clients.length, org.slug === 'city-spaces' ? 45 : 18)).forEach((c, i) => {
      const stage = stageKeys[i % stageKeys.length]!;
      const listing = R.pick(orgListings.length ? orgListings : anyListings);
      const value = listing.dealType === 'rent' ? listing.priceMinor! * 12 : listing.priceMinor!;
      const pct = listing.dealType === 'rent' ? 8.33 : 3;
      const created = new Date(NOW.getTime() - R.int(5, 150) * DAY);
      deals.push({
        id: newId(),
        orgId: org.id,
        pipelineId,
        contactId: c.id!,
        listingId: listing.id!,
        title: `${c.name} — ${listing.title!.split(',')[0]}`,
        stage,
        position: i,
        valueMinor: value,
        commissionPct: pct,
        commissionMinor: Math.round((value * pct) / 100),
        agentId: c.ownerAgentId,
        agentSharePct: R.pick([40, 50, 60]),
        source: c.source,
        lostReason: stage === 'lost' ? R.pick(['ბიუჯეტი არ ეყო', 'აირჩია სხვა ფართი', 'ბიზნეს-გეგმა გადაიდო']) : null,
        expectedCloseAt: at(R.int(5, 60)),
        closedAt: stage === 'won' || stage === 'lost' ? new Date(created.getTime() + R.int(10, 60) * DAY) : null,
        createdAt: created,
        stageChangedAt: new Date(created.getTime() + R.int(1, 10) * DAY),
      });
    });
    await insertMany(tx, s.crmDeals, deals);

    const tasks: (typeof s.crmTasks.$inferInsert)[] = [];
    const activities: (typeof s.crmActivities.$inferInsert)[] = [];
    for (const d of deals.slice(0, 30)) {
      tasks.push({ orgId: org.id, dealId: d.id!, contactId: d.contactId, title: R.pick(['დაურეკე: ჩვენების დადასტურება', 'გაუგზავნე 3 ალტერნატიული ფართი', 'ხელშეკრულების პროექტი', 'მესაკუთრესთან ფასის შეთანხმება']), dueAt: at(R.int(-3, 7)), assigneeId: d.agentId, priority: R.pick(['low', 'normal', 'high'] as const), doneAt: R.chance(0.3) ? at(-1) : null });
      activities.push(
        { orgId: org.id, entity: 'deal', entityId: d.id!, type: 'stage_change', payload: { from: 'lead', to: d.stage }, createdBy: d.agentId, createdAt: d.stageChangedAt },
        { orgId: org.id, entity: 'contact', entityId: d.contactId, type: 'call', payload: { direction: 'out', durationSec: R.int(40, 600), outcome: 'answered', note: 'ინტერესი დადასტურდა, ჩვენება ხუთშაბათს.' }, createdBy: d.agentId },
        { orgId: org.id, entity: 'contact', entityId: d.contactId, type: 'note', payload: { body: 'კლიენტს სჭირდება გამწოვი და ვიტრინა.' }, createdBy: d.agentId },
      );
    }
    await insertMany(tx, s.crmTasks, tasks);
    await insertMany(tx, s.crmActivities, activities);

    const viewings: (typeof s.crmViewings.$inferInsert)[] = [];
    for (let k = 0; k < 16; k++) {
      const l = R.pick(anyListings);
      const start = at(Math.floor(k / 4));
      start.setHours(10 + (k % 4) * 2, R.pick([0, 30]), 0, 0);
      const d = R.pick(deals);
      viewings.push({ orgId: org.id, contactId: d.contactId, listingId: l.id!, dealId: d.id!, agentId: R.pick(orgAgents), title: `ჩვენება: ${l.title!.split(',')[0]}`, address: l.address, startsAt: start, endsAt: new Date(start.getTime() + 45 * 60_000), lat: l.lat, lng: l.lng, status: 'planned' });
    }
    await insertMany(tx, s.crmViewings, viewings);

    await insertMany(tx, s.crmMatches, clients.slice(0, 20).flatMap((c) => R.sample(anyListings, 3).map((l) => ({ orgId: org.id, contactId: c.id!, listingId: l.id!, score: R.int(60, 98), status: R.pick(['new', 'sent', 'liked', 'disliked'] as const) }))));

    const seqId = newId();
    await insertMany(tx, s.crmSequences, [
      { id: seqId, orgId: org.id, name: 'ჩვენების შემდეგ', trigger: 'after_viewing', steps: [{ delayDays: 0, channel: 'sms', template: 'გმადლობთ ჩვენებისთვის! შეკითხვის შემთხვევაში დამიკავშირდით.' }, { delayDays: 3, channel: 'email', template: 'კიდევ 3 მსგავსი ფართი, რომელიც შეიძლება დაგაინტერესოს.' }, { delayDays: 7, channel: 'sms', template: 'ისევ ეძებთ ფართს? მოვიდა ახალი ვარიანტები.' }] },
      { orgId: org.id, name: 'ახალი ლიდი', trigger: 'new_lead', steps: [{ delayDays: 0, channel: 'sms', template: 'გამარჯობა! გწერთ lokacia.ge-ს ბროკერი.' }], active: false },
    ]);
    await insertMany(tx, s.crmSequenceRuns, deals.slice(0, 5).map((d, k) => ({ orgId: org.id, sequenceId: seqId, contactId: d.contactId, dealId: d.id!, step: k % 3, nextAt: at(k - 1), status: 'running' as const })));

    await insertMany(tx, s.presentations, [
      { orgId: org.id, createdBy: orgAgents[0], contactId: clients[0]!.id!, title: 'შერჩეული ფართები — კაფე', message: 'გაგიგზავნით 4 ვარიანტს, რომელიც ყველაზე ახლოს არის თქვენ მოთხოვნებთან.', listingIds: R.sample(anyListings, 4).map((l) => l.id!), token: org.slug === 'city-spaces' ? 'demo-presentation' : randomBytes(12).toString('base64url'), openedAt: at(-1), openCount: 3 },
      { orgId: org.id, createdBy: orgAgents[0], contactId: clients[1]!.id!, title: 'ოფისები საბურთალოზე', listingIds: R.sample(anyListings, 3).map((l) => l.id!), token: randomBytes(12).toString('base64url') },
    ]);

    await insertMany(tx, s.documents, [
      { orgId: org.id, dealId: deals[0]!.id!, contactId: deals[0]!.contactId, template: 'exclusivity', title: 'ექსკლუზიური მომსახურების ხელშეკრულება', version: 2, signStatus: 'signed', signProvider: 'mock', signRef: 'mock-sign-1', signedAt: at(-10), content: { commissionPct: 50, termMonths: 6 } },
      { orgId: org.id, dealId: deals[1]!.id!, contactId: deals[1]!.contactId, template: 'act', title: 'ფართის მიღება-გადაცემის აქტი', version: 1, signStatus: 'sent', signProvider: 'mock', signRef: 'mock-sign-2' },
      { orgId: org.id, dealId: deals[2]!.id!, template: 'lease', title: 'იჯარის ხელშეკრულების პროექტი', version: 1, signStatus: 'draft' },
    ]);

    const tracks = orgListings.slice(0, 4).map((l, k) => ({ id: newId(), orgId: org.id, listingId: l.id!, url: `https://example-portal.ge/listing/${1000 + k}`, portal: R.pick(['ss.ge', 'myhome.ge']), lastPriceMinor: l.priceMinor! + R.int(-2, 2) * 10_000, lastCheckedAt: at(-1) }));
    await insertMany(tx, s.competitorTracks, tracks);
    await insertMany(tx, s.competitorPriceChanges, tracks.flatMap((t) => [{ orgId: org.id, trackId: t.id, oldPriceMinor: t.lastPriceMinor + 20_000, newPriceMinor: t.lastPriceMinor, createdAt: at(-R.int(2, 20)) }]));

    await insertMany(tx, s.ownerReports, orgListings.slice(0, 5).map((l) => ({ orgId: org.id, listingId: l.id!, weekStart: new Date(NOW.getTime() - 7 * DAY).toISOString().slice(0, 10), payload: { views: R.int(40, 400), reveals: R.int(2, 30), saves: R.int(1, 20), viewings: R.int(0, 5) }, sentAt: at(-2) })));
  }

  const [a, b] = orgs;
  const shared = listings.filter((l) => l.orgId === a!.id && l.status === 'active').slice(0, 3);
  await insertMany(tx, s.coBrokerShares, shared.map((l, k) => ({ listingId: l.id!, fromOrgId: a!.id, toOrgId: b!.id, splitPct: 50, status: k === 0 ? ('accepted' as const) : ('proposed' as const), note: 'კომისია 50/50' })));
}
