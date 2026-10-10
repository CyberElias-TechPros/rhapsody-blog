import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    // The content suite parses two monthly PDFs (≈144 pages) before asserting on the text.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
