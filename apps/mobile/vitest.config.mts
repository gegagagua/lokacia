import { defineConfig } from 'vitest/config';

/** Unit tests for pure logic (API client, geometry, formatting) — no React Native runtime needed. */
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
