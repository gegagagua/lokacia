import { config } from "dotenv";
config({ path: "../../.env", quiet: true });
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://lokacia:lokacia@localhost:5432/lokacia' },
  extensionsFilters: ['postgis'],
});
