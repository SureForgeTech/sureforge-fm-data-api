import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['/workspace/.fm-scratch/r5/followup.test.ts'],
    setupFiles: ['/workspace/sureforge-fm-data-api-wt-567/extension/test/setup.ts']
  }
});
