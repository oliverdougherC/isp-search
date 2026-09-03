import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    environment: 'node',
    // Integration tests talk to loopback PostgreSQL only; the no-network guard allows loopback.
    setupFiles: ['../../tooling/vitest/no-network.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
