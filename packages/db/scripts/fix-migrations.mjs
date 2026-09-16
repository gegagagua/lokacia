// drizzle-kit quotes parameterised custom types ("geography(Point,4326)"), which Postgres rejects.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../drizzle/', import.meta.url);
for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
  const p = new URL(f, dir);
  const s = readFileSync(p, 'utf8');
  const out = s.replace(/"(geography\([A-Za-z]+,4326\))"/g, '$1');
  if (out !== s) writeFileSync(p, out);
}
