import base from './eslint.config.js';
import reactHooks from 'eslint-plugin-react-hooks';

/** React Native / Expo flavour (apps/mobile): base TS rules + react-hooks; Metro/Expo config files are CommonJS. */
export default [
  ...base,
  { ignores: ['**/.expo/**', '**/android/**', '**/ios/**', '**/expo-env.d.ts'] },
  {
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
  {
    files: ['**/metro.config.js', '**/babel.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
