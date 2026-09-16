import postgres from 'postgres';
import { DATABASE_URL } from './env';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('refusing to reset in production');
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => undefined });
  await sql`drop schema if exists public cascade`;
  await sql`drop schema if exists drizzle cascade`;
  await sql`create schema public`;
  await sql.end();
  console.log('database reset');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
