import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import sharp from 'sharp';
import { v7 as uuidv7 } from 'uuid';
import { and, eq, isNull, listingMedia } from '@lokacia/db';
import { DbService } from '../../common/db.service';
import { problems } from '../../common/problem';
import { QueueService } from '../../common/queue.service';
import { TokensService } from '../../common/tokens.service';
import type { AuthUser } from '../../common/request';
import { STORAGE, type Storage } from '../../integrations/storage/storage';
import { ListingReadService } from '../listings/listing-read.service';

export const MEDIA_KINDS = ['photo', 'video', 'plan', 'pano360', 'document'] as const;
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif|avif)|video\/(mp4|webm|quicktime)|application\/pdf|model\/(gltf-binary|gltf\+json|obj|vnd\.usdz\+zip)|application\/octet-stream|audio\/(webm|mpeg|mp4|ogg|wav))$/;
const VARIANTS = { sm: 480, md: 960, lg: 1600 } as const;

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger('Media');
  constructor(
    private readonly dbs: DbService,
    private readonly queue: QueueService,
    private readonly tokens: TokensService,
    private readonly read: ListingReadService,
    @Inject(STORAGE) readonly storage: Storage,
  ) {}

  onModuleInit() {
    this.queue.register('media.process', (d: { mediaId: string }) => this.process(d.mediaId));
  }

  async createUpload(user: AuthUser, input: { kind: (typeof MEDIA_KINDS)[number]; contentType: string; fileName: string; listingId?: string | null; size?: number }) {
    if (!ALLOWED.test(input.contentType)) throw problems.badRequest('ფაილის ტიპი არ არის დაშვებული');
    if (input.size && input.size > 25 * 1024 * 1024) throw problems.badRequest('ფაილი 25 მბ-ზე დიდია');
    if (input.listingId) {
      const l = await this.read.findRaw(input.listingId);
      if (!l || !(await this.read.canManage(l, user))) throw problems.forbidden();
    }
    const ext = (input.fileName.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'bin';
    const id = uuidv7();
    const key = `uploads/${new Date().toISOString().slice(0, 7)}/${id}/original.${ext}`;
    await this.dbs.db.insert(listingMedia).values({ id, listingId: input.listingId ?? null, uploaderId: user.id, kind: input.kind, url: this.storage.publicUrl(key), storageKey: key, status: 'uploading', sort: 999 });
    const token = this.uploadToken(key);
    return { id, key, method: 'PUT', uploadUrl: await this.storage.uploadUrl(key, input.contentType, token), headers: { 'content-type': input.contentType } };
  }

  uploadToken(key: string) {
    const exp = Date.now() + 15 * 60_000;
    return `${exp}.${this.tokens.hmac(`${key}:${exp}`)}`;
  }

  verifyUploadToken(key: string, token: string) {
    const [exp, sig] = token.split('.');
    if (!exp || !sig || Number(exp) < Date.now()) return false;
    return this.tokens.safeEqual(sig, this.tokens.hmac(`${key}:${exp}`));
  }

  /** Local driver: body received by the API. */
  async receiveLocal(key: string, token: string, body: Buffer, contentType: string) {
    if (!this.verifyUploadToken(key, token)) throw problems.forbidden('ატვირთვის ბმულის ვადა გაუვიდა');
    const media = await this.dbs.db.query.listingMedia.findFirst({ where: eq(listingMedia.storageKey, key) });
    if (!media) throw problems.notFound('ფაილი');
    if (!body.length) throw problems.badRequest('ფაილი ცარიელია');
    await this.storage.put(key, body, contentType);
    await this.complete(media.id);
    return { id: media.id };
  }

  async complete(mediaId: string) {
    await this.dbs.db.update(listingMedia).set({ status: 'processing' }).where(eq(listingMedia.id, mediaId));
    await this.queue.add('media.process', { mediaId });
    return { id: mediaId, status: 'processing' };
  }

  /** Image pipeline: auto-rotate by EXIF, strip metadata, webp variants. Non-images are marked ready. */
  async process(mediaId: string) {
    const m = await this.dbs.db.query.listingMedia.findFirst({ where: eq(listingMedia.id, mediaId) });
    if (!m?.storageKey) return;
    const original = await this.storage.get(m.storageKey);
    if (!original) {
      await this.dbs.db.update(listingMedia).set({ status: 'failed' }).where(eq(listingMedia.id, mediaId));
      return;
    }
    const isImage = ['photo', 'plan', 'pano360'].includes(m.kind);
    if (!isImage) {
      await this.dbs.db.update(listingMedia).set({ status: 'ready' }).where(eq(listingMedia.id, mediaId));
      return;
    }
    try {
      const base = sharp(original, { failOn: 'none' }).rotate(); // rotate() applies EXIF orientation; output drops metadata
      const meta = await base.metadata();
      const variants: Record<string, string> = {};
      const dir = m.storageKey.replace(/\/[^/]+$/, '');
      for (const [name, width] of Object.entries(VARIANTS)) {
        const buf = await base.clone().resize({ width: m.kind === 'pano360' ? width * 2 : width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        const key = `${dir}/${name}.webp`;
        await this.storage.put(key, buf, 'image/webp');
        variants[name] = this.storage.publicUrl(key);
      }
      // stripped full-size copy replaces the original URL
      const clean = await base.clone().webp({ quality: 88 }).toBuffer();
      const cleanKey = `${dir}/full.webp`;
      await this.storage.put(cleanKey, clean, 'image/webp');
      await this.storage.delete(m.storageKey);
      await this.dbs.db
        .update(listingMedia)
        .set({ status: 'ready', variants, url: this.storage.publicUrl(cleanKey), storageKey: cleanKey, width: meta.autoOrient?.width ?? meta.width, height: meta.autoOrient?.height ?? meta.height })
        .where(eq(listingMedia.id, mediaId));
    } catch (e) {
      this.logger.warn(`process ${mediaId} failed: ${(e as Error).message}`);
      await this.dbs.db.update(listingMedia).set({ status: 'failed' }).where(eq(listingMedia.id, mediaId));
    }
  }

  /** C11 image part: light/contrast normalization + mild sharpening + straighten small tilt. */
  async enhance(user: AuthUser, mediaId: string, rotateDeg = 0) {
    const m = await this.owned(user, mediaId);
    if (!m.storageKey || m.kind !== 'photo') throw problems.badRequest('გაუმჯობესება მხოლოდ ფოტოსთვის');
    const src = await this.storage.get(m.storageKey);
    if (!src) throw problems.notFound('ფაილი');
    const out = await sharp(src)
      .rotate(rotateDeg, { background: '#EDF0EB' })
      .normalise({ lower: 1, upper: 99 })
      .modulate({ brightness: 1.06, saturation: 1.04 })
      .sharpen({ sigma: 0.8 })
      .webp({ quality: 88 })
      .toBuffer();
    const key = m.storageKey.replace(/\/[^/]+$/, `/enhanced-${Date.now()}.webp`);
    await this.storage.put(key, out, 'image/webp');
    const variants = { ...(m.variants ?? {}), enhanced: this.storage.publicUrl(key) };
    const [row] = await this.dbs.db.update(listingMedia).set({ variants, url: this.storage.publicUrl(key), storageKey: key }).where(eq(listingMedia.id, mediaId)).returning();
    // regenerate size variants from the enhanced image
    await this.queue.add('media.process', { mediaId });
    return row;
  }

  private async owned(user: AuthUser, mediaId: string) {
    const m = await this.dbs.db.query.listingMedia.findFirst({ where: and(eq(listingMedia.id, mediaId), isNull(listingMedia.deletedAt)) });
    if (!m) throw problems.notFound('ფაილი');
    if (m.uploaderId === user.id || user.role === 'admin' || user.role === 'moderator') return m;
    if (m.listingId) {
      const l = await this.read.findRaw(m.listingId);
      if (l && (await this.read.canManage(l, user))) return m;
    }
    throw problems.forbidden();
  }

  async get(user: AuthUser, mediaId: string) {
    return this.owned(user, mediaId);
  }

  async update(user: AuthUser, mediaId: string, patch: { alt?: string; isFloorplan?: boolean; kind?: (typeof MEDIA_KINDS)[number] }) {
    await this.owned(user, mediaId);
    const [row] = await this.dbs.db.update(listingMedia).set(patch).where(eq(listingMedia.id, mediaId)).returning();
    return row;
  }

  async reorder(user: AuthUser, ids: string[]) {
    for (const [i, id] of ids.entries()) {
      await this.owned(user, id);
      await this.dbs.db.update(listingMedia).set({ sort: i }).where(eq(listingMedia.id, id));
    }
    return { ok: true };
  }

  async remove(user: AuthUser, mediaId: string) {
    await this.owned(user, mediaId);
    await this.dbs.db.update(listingMedia).set({ deletedAt: new Date() }).where(eq(listingMedia.id, mediaId));
    return { ok: true };
  }
}
