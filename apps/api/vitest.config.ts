import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/global-setup.ts'],
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Test files share one database; run them sequentially for determinism.
    fileParallelism: false,
  },
});
