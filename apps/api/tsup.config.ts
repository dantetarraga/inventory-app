import { defineConfig } from 'tsup';

export default defineConfig({
  // Flat output (dist/server.js, dist/migrate.js…) so ../drizzle resolves from every entry.
  entry: { server: 'src/server.ts', migrate: 'src/db/migrate.ts', seed: 'src/db/seed.ts' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // The shared workspace package ships TypeScript sources, so bundle it in.
  noExternal: ['@stockpro/shared'],
});
