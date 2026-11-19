import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'node', globals: true, include: ['/workspace/sureforge-fm-data-api-wt-567/extension/test/unit/fmWebPromptDraft.test.ts'], root: '/workspace/sureforge-fm-data-api-wt-567/extension' }
});
