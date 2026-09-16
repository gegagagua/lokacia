import base from './eslint.config.js';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';

/** React/Next flavour: react-hooks + @next/next (recommended + core-web-vitals as warnings), stories allow hooks in `render`. */
const nextRules = Object.fromEntries(
  Object.keys({ ...nextPlugin.configs.recommended.rules, ...nextPlugin.configs['core-web-vitals'].rules }).map((r) => [r, 'warn']),
);

export default [
  ...base,
  {
    plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn', ...nextRules, '@next/next/no-html-link-for-pages': 'off' /* App Router only */ },
  },
  {
    // Storybook CSF: `render: () => { useState… }` is the documented pattern.
    files: ['**/*.stories.tsx', '**/*.stories.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
];
