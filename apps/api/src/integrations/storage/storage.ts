export interface Storage {
  readonly name: 'local' | 's3';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** Public URL (relative `/api/v1/media/files/<key>` for local). */
  publicUrl(key: string): string;
  /** URL the browser uploads to (PUT). Local: API endpoint with signed token; S3: presigned URL. */
  uploadUrl(key: string, contentType: string, token: string): Promise<string>;
}
export const STORAGE = Symbol('STORAGE');
