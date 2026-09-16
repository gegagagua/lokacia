process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://lokacia:lokacia@localhost:5432/lokacia_test';
process.env.QUEUE_DRIVER = 'inline';
process.env.JOBS_ENABLED = 'false';
process.env.ANTHROPIC_API_KEY = '';
process.env.STORAGE_DIR = require('node:path').resolve(__dirname, '../../../storage-test');
