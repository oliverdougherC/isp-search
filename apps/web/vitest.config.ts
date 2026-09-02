import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**'],
    environment: 'node',
    setupFiles: ['../../tooling/vitest/no-network.ts'],
  },
});
