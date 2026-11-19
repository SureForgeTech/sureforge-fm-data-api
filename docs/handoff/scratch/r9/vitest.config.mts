import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['*.test.ts'],
    globals: true,
    setupFiles: ['./setup.ts'],
    testTimeout: 60000
  }
});
