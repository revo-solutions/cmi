import { defineConfig } from 'orval';

export default defineConfig({
  cmi: {
    input: {
      target: './openapi.json',
      filters: { tags: ['Account', 'Auth', 'Contact', 'Sos', 'Sync'] },
    },
    output: {
      target: './src/api/generated/client.ts',
      client: 'fetch',
      clean: true,
      override: {
        fetch: { includeHttpResponseReturnType: false },
        mutator: { path: './src/api/client.ts', name: 'apiClient' },
      },
    },
  },
});
