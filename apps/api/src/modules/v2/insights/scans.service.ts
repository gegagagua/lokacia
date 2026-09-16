import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { and, desc, eq, isNull, listingMedia, scans, spacePassports } from '@lokacia/db';
import { SCAN_FORMATS, type ScanDto, type ScanFormat } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { problems } from '../../../common/problem';
import { QueueService } from '../../../common/queue.service';
import type { AuthUser } from '../../../common/request';
import { STORAGE, type Storage } from '../../../integrations/storage/storage';
import { ListingReadService } from '../../listings/listing-read.service';
import { planFromScan } from './glb';

type ScanRow = typeof scans.$inferSelect;
export const DEMO_SCAN_URL = '/api/v1/v2/scans/demo/room.glb';

/** V5: scan upload (GLB/GLTF/OBJ/USDZ/PLY) → floor-plan generation → space passport outline. */
@Injectable()
export class ScansService implements OnModuleInit {
  private readonly logger = new Logger('Scans');
  constructor(
    private readonly dbs: DbService,
    private readonly read: ListingReadService,
    private readonly queue: QueueService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  onModuleInit() {
    this.queue.register('v2.scans.process', (d: { scanId: string; storageKey: string | null }) => this.process(d.scanId, d.storageKey));
  }

  dto(s: ScanRow): ScanDto {
    const url = s.url.startsWith('/api/v1/media/demo/') ? DEMO_SCAN_URL : s.url;
    return { id: s.id, listingId: s.listingId, format: s.format, url, status: s.status, plan: s.plan ?? null, createdAt: s.createdAt.toISOString() };
  }

  async list(idOrSlug: string, includeAll = false) {
    const l = await this.read.findRaw(idOrSlug);
    if (!l) throw problems.notFound('განცხადება');
    const rows = await this.dbs.db.select().from(scans).where(and(eq(scans.listingId, l.id), isNull(scans.deletedAt))).orderBy(desc(scans.createdAt));
    return rows.filter((r) => includeAll || r.status === 'ready').map((r) => this.dto(r));
  }

  async create(user: AuthUser, idOrSlug: string, input: { mediaId: string; format?: ScanFormat }) {
    const l = await this.read.findRaw(idOrSlug);
    if (!l) throw problems.notFound('განცხადება');
    if (!(await this.read.canManage(l, user))) throw problems.forbidden();
    const media = await this.dbs.db.query.listingMedia.findFirst({ where: and(eq(listingMedia.id, input.mediaId), isNull(listingMedia.deletedAt)) });
    if (!media || (media.uploaderId !== user.id && user.role !== 'admin')) throw problems.notFound('ფაილი');
    const ext = (media.storageKey ?? media.url).split('.').pop()?.toLowerCase() as ScanFormat | undefined;
    const format = input.format ?? (ext && (SCAN_FORMATS as readonly string[]).includes(ext) ? ext : undefined);
    if (!format) throw problems.badRequest('ფორმატი არ არის მხარდაჭერილი: GLB, GLTF, OBJ, USDZ, PLY');
    if (!media.listingId) await this.dbs.db.update(listingMedia).set({ listingId: l.id, kind: 'document' }).where(eq(listingMedia.id, media.id));
    const [row] = await this.dbs.db.insert(scans).values({ listingId: l.id, uploadedBy: user.id, format, url: media.url, status: 'processing' }).returning();
    await this.queue.add('v2.scans.process', { scanId: row!.id, storageKey: media.storageKey });
    return this.dto(row!);
  }

  /** Floor plan from the model bounds (or the floor ring); USDZ/binary PLY fall back to passport dimensions. */
  async process(scanId: string, storageKey: string | null) {
    const scan = await this.dbs.db.query.scans.findFirst({ where: eq(scans.id, scanId) });
    if (!scan) return;
    const buf = storageKey ? await this.storage.get(storageKey) : null;
    let plan = buf ? planFromScan(scan.format, buf) : null;
    const passport = await this.dbs.db.query.spacePassports.findFirst({ where: eq(spacePassports.listingId, scan.listingId) });
    if (!plan && passport?.widthM && passport.depthM) {
      const w = passport.widthM;
      const d = passport.depthM;
      plan = { outline: [[0, 0], [w, 0], [w, d], [0, d]], widthM: w, depthM: d, areaM2: Math.round(w * d * 10) / 10 };
    }
    if (!buf) {
      await this.dbs.db.update(scans).set({ status: 'failed' }).where(eq(scans.id, scanId));
      return;
    }
    await this.dbs.db.update(scans).set({ status: 'ready', plan }).where(eq(scans.id, scanId));
    if (plan) {
      const patch = { outline: plan.outline, widthM: plan.widthM, depthM: plan.depthM };
      if (passport) await this.dbs.db.update(spacePassports).set(patch).where(eq(spacePassports.id, passport.id));
      else await this.dbs.db.insert(spacePassports).values({ listingId: scan.listingId, ...patch });
    }
    this.logger.log(`scan ${scanId} ready (${plan ? `${plan.widthM}×${plan.depthM} m` : 'no plan'})`);
  }
}
