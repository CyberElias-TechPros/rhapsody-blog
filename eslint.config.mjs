import { defineConfig, globalIgnores } from 'eslint/config';
import next from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  // The archived Vite SPA and the Worker have their own tooling; don't lint them from here.
  globalIgnores(['legacy/**', 'worker/**', '.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**']),
  ...next,
  ...nextTs,
  {
    rules: {
      // Devotional covers are remote/unknown URLs and typographic cards; <img> keeps them
      // out of the image optimiser's build-time domain allowlist.
      '@next/next/no-img-element': 'off',
      'react/no-unescaped-entities': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Content extraction runs in Node, not in the browser.
    files: ['scripts/**/*.mjs', 'vitest.config.ts', 'next.config.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
]);
