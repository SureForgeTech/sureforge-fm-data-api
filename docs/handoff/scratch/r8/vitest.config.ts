import { defineConfig } from 'vitest/config';

const EXT = '/workspace/sureforge-fm-data-api-wt-home/extension';

export default defineConfig({
  root: '/workspace',
  test: {
    environment: 'node',
    include: ['.fm-scratch/r8/**/*.test.ts'],
    globals: true,
    setupFiles: [`${EXT}/test/setup.ts`]
  }
});
