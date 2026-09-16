import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { DATABASE_URL } from './env';
import { createDb } from './client';

export async function runMigrations(url: string) {
  const { db, client } = createDb(url, { max: 1 });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../drizzle') });
  await client.end();
}

if (require.main === module) {
  runMigrations(process.env.MIGRATE_DATABASE_URL ?? DATABASE_URL)
    .then(() => console.log('migrations applied'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
