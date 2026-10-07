import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/private-file-boundary.integration-test.ts'],
    setupFiles: ['./test/setup/test-database.ts'],
    fileParallelism: false,
  },
});
