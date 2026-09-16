import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

export const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://lokacia:lokacia@localhost:5432/lokacia';
