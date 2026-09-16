import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';

const here = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  typescript: { reactDocgen: 'react-docgen-typescript' },
  async viteFinal(cfg) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(cfg, {
      plugins: [tailwindcss()],
      resolve: {
        // Contracts ship CommonJS in dist/ for NestJS; Storybook consumes the TypeScript source directly.
        alias: { '@lokacia/contracts': path.resolve(here, '../../contracts/src/index.ts') },
      },
    });
  },
};
export default config;
