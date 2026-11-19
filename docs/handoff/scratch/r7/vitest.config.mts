import { createRequire } from 'node:module';

const require = createRequire('/workspace/sureforge-fm-data-api-wt-home/package.json');
const { defineConfig } = require('vitest/config');

export default defineConfig({
  root: '/workspace/sureforge-fm-data-api-wt-home/extension',
  test: {
    environment: 'node',
    globals: true,
    include: ['/workspace/.fm-scratch/r7/review.test.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    testTimeout: 120000
  }
});
