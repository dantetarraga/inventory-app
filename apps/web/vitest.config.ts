import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // e2e/ holds Playwright specs, run with `pnpm e2e`.
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
