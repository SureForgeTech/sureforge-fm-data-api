import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', globals: true, include: ['/workspace/.fm-scratch/r5/*.test.ts'] }
});
