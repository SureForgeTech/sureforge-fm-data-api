import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '/workspace/sureforge-fm-data-api-wt-home/extension',
  test: {
    environment: 'node',
    include: ['/workspace/.fm-scratch/r7/review.test.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    testTimeout: 120000
  }
});
