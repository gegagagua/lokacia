import { createHash, createHmac } from 'node:crypto';
import type { Storage } from './storage';

/** Minimal S3/R2 adapter using SigV4 query presigning (no SDK dependency). */
export class S3Storage implements Storage {
  readonly name = 's3' as const;
  constructor(private readonly cfg: { endpoint: string; bucket: string; accessKey: string; secretKey: string; region?: string; publicBase?: string }) {}

  private presign(method: string, key: string, expires = 900) {
    const url = new URL(`${this.cfg.endpoint.replace(/\/$/, '')}/${this.cfg.bucket}/${key}`);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = amzDate.slice(0, 8);
    const region = this.cfg.region ?? 'auto';
    const scope = `${date}/${region}/s3/aws4_request`;
    url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
    url.searchParams.set('X-Amz-Credential', `${this.cfg.accessKey}/${scope}`);
    url.searchParams.set('X-Amz-Date', amzDate);
    url.searchParams.set('X-Amz-Expires', String(expires));
    url.searchParams.set('X-Amz-SignedHeaders', 'host');
    const canonical = [method, url.pathname, [...url.searchParams].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'), `host:${url.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
    const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
    const h = (k: Buffer | string, d: string) => createHmac('sha256', k).update(d).digest();
    const signingKey = h(h(h(h(`AWS4${this.cfg.secretKey}`, date), region), 's3'), 'aws4_request');
    url.searchParams.set('X-Amz-Signature', createHmac('sha256', signingKey).update(toSign).digest('hex'));
    return url.toString();
  }

  async put(key: string, body: Buffer, contentType: string) {
    const res = await fetch(this.presign('PUT', key), { method: 'PUT', body: new Uint8Array(body), headers: { 'content-type': contentType } });
    if (!res.ok) throw new Error(`s3 put failed: ${res.status}`);
  }
  async get(key: string) {
    const res = await fetch(this.presign('GET', key));
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  async delete(key: string) {
    await fetch(this.presign('DELETE', key), { method: 'DELETE' });
  }
  publicUrl(key: string) {
    return this.cfg.publicBase ? `${this.cfg.publicBase}/${key}` : `/api/v1/media/files/${key}`;
  }
  async uploadUrl(key: string) {
    return this.presign('PUT', key);
  }
}
