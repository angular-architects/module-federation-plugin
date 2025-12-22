import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { sep } from 'node:path';
import { join } from 'node:path/posix';
import { defineConfig } from 'vite';

const projectName = __dirname.split(sep).pop() ?? 'native-federation-runtime';

export default defineConfig({
  root: __dirname,
  cacheDir: join('../../node_modules/.vite/tests', projectName),
  plugins: [nxViteTsPaths()],
  // Serve static files for MSW Service Worker
  publicDir: 'public',
});
