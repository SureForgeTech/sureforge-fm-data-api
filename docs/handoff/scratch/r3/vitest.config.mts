import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', globals: true, include: ['/workspace/.fm-scratch/r3/*.test.ts'], exclude: ['/workspace/.fm-scratch/r3/cmd-*.test.ts'] }
});
