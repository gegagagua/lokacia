import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@lokacia/contracts': path.resolve(__dirname, '../contracts/src/index.ts') } },
  // Component tests opt into jsdom with a `// @vitest-environment jsdom` docblock; token tests stay in node.
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
