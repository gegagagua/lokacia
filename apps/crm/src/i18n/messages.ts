import fs from 'node:fs/promises';
import path from 'node:path';

export const LOCALES = ['ka', 'en', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

type Tree = { [k: string]: string | Tree };

function mergeFallback(base: Tree, over: Tree): Tree {
  const out: Tree = {};
  for (const [k, v] of Object.entries(base)) {
    const o = over[k];
    if (typeof v === 'string') out[k] = typeof o === 'string' && o !== '' ? o : v;
    else out[k] = mergeFallback(v, (o && typeof o === 'object' ? o : {}) as Tree);
  }
  return out;
}

async function readDir(locale: Locale): Promise<Tree> {
  const dir = path.join(process.cwd(), 'messages', locale);
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'));
  const out: Tree = {};
  for (const f of files) out[f.replace(/\.json$/, '')] = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')) as Tree;
  return out;
}

/** messages/<locale>/<namespace>.json — one file per feature area so teams don't collide. */
export async function loadMessages(locale: Locale): Promise<Tree> {
  const ka = await readDir('ka');
  return locale === 'ka' ? ka : mergeFallback(ka, await readDir(locale));
}
