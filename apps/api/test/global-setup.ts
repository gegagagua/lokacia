import { execSync } from 'node:child_process';
import path from 'node:path';

/** Fresh schema + small deterministic seed in the test database (real Postgres, CLAUDE.md). */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://lokacia:lokacia@localhost:5432/lokacia_test';
  const dbPkg = path.resolve(__dirname, '../../../packages/db');
  const env = { ...process.env, DATABASE_URL: url, SEED_LISTINGS: '160', NODE_ENV: 'test' };
  execSync('npx tsx src/reset.ts && npx tsx src/migrate.ts && npx tsx src/seed/index.ts', { cwd: dbPkg, env, stdio: 'pipe' });
}
