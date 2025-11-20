import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { sep } from 'node:path';
import { join } from 'node:path/posix';
import { defineConfig } from 'vite';

const projectName = __dirname.split(sep).pop() ?? 'whiskmate';

export default defineConfig({
  root: __dirname,
  cacheDir: join('../../node_modules/.vite/tests', projectName),
  plugins: [nxViteTsPaths()],
});
