import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Vitest runs the Node-side suites (content layer, extractor ↔ PDF contract, search, format,
 * RSS) in the `node` environment and the component/placement test in `jsdom` via its
 * `// @vitest-environment jsdom` docblock. `@/` resolves exactly as it does in tsconfig.json.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    // The PDF ↔ Markdown suites parse ~50 PDFs; give them room.
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
