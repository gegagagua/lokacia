import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/drizzle/**', '**/coverage/**', '**/storybook-static/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Georgian formatting legitimately uses NBSP / thin spaces inside strings, templates and regexes.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true, skipRegExps: true, skipComments: true, skipJSXText: true }],
    },
  },
  {
    files: ['**/test/**', '**/*.test.ts', '**/*.test.tsx', '**/*.config.{js,mjs,ts,mts}'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
