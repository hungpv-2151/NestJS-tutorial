import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/migrations-roundtrip.migration-test.ts'],
    setupFiles: ['./test/setup/test-database.ts'],
    fileParallelism: false,
  },
});
