import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.integration.test.ts'],
    environment: 'node',
    setupFiles: ['../../tooling/vitest/no-network.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
