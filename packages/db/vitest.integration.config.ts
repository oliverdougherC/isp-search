import { defineConfig } from 'vitest/config';

/**
 * Integration tests need a live PostgreSQL (DATABASE_URL_TEST or DATABASE_URL). They run
 * sequentially because they share the queue schema and mutate it.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ['../../tooling/vitest/no-network.ts'],
  },
});
