import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.angular'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/native-federation-runtime',
      provider: 'v8',
    },
    watch: false,
    pool: 'threads',
  },
});
