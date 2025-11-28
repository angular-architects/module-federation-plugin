import { defineConfig } from 'vitest/config';

const testPatterns = ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'];
const integrationTestPatterns = ['src/**/*.integration.spec.ts'];

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/native-federation-runtime',
      provider: 'v8',
    },
    watch: false,
    pool: 'threads',
    exclude: ['node_modules', 'dist', '.angular'],
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: testPatterns,
          exclude: [
            ...integrationTestPatterns,
            'node_modules',
            'dist',
            '.angular',
          ],
        },
      },
      {
        test: {
          name: 'integration',
          include: integrationTestPatterns,
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: process.env.CI === 'true',
            instances: [
              {
                browser: 'chromium',
              },
            ],
            // Serve static assets for MSW
            api: {
              host: '127.0.0.1',
            },
          },
        },
      },
    ],
  },
});
