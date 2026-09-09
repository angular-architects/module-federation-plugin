import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    watch: false,
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/native-federation-core',
      provider: 'v8',
    },
  },
});
