import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Storage } from './storage';

export class LocalStorage implements Storage {
  readonly name = 'local' as const;
  constructor(private readonly root: string) {}

  private file(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root))) throw new Error('invalid key');
    return p;
  }

  async put(key: string, body: Buffer) {
    const p = this.file(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
  }

  async get(key: string) {
    try {
      return await readFile(this.file(key));
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await rm(this.file(key), { force: true });
  }

  publicUrl(key: string) {
    return `/api/v1/media/files/${key}`;
  }

  async uploadUrl(key: string, _contentType: string, token: string) {
    return `/api/v1/media/uploads/${encodeURIComponent(key)}?token=${token}`;
  }
}
