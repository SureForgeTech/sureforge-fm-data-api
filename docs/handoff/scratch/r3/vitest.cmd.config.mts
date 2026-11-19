import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['/workspace/.fm-scratch/r3/cmd-*.test.ts'],
    setupFiles: ['/workspace/sureforge-fm-data-api-wt-567/extension/test/setup.ts']
  }
});
