import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    environment: 'node',
    setupFiles: ['./vitest/no-network.ts'],
    testTimeout: 30_000,
  },
});
