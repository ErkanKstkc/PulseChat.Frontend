import { defineConfig } from 'orval';

export default defineConfig({
  pulseChatApi: {
    input: {
      target: './swagger.json',
    },
    output: {
      mode: 'tags-split',
      target: './src/api/generated',
      schemas: './src/api/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: './src/api/axios-instance.ts',
          name: 'customAxiosInstance',
        },
        query: {
          useQuery: true,
          useMutation: true,
          version: 5,
        },
      },
    },
  },
});
