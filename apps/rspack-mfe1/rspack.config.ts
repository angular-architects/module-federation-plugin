import { createConfig } from '@nx/angular-rspack';
import applyFederation from './module-federation.config';

// `createConfig` resolves to a raw rspack `Configuration[]`, which
// `applyFederation` then decorates with the Module Federation container.
// Paths are relative to this file's directory: the rspack CLI runs with the
// project root as its cwd.
export default createConfig({
  options: {
    browser: './src/main.ts',
    index: './src/index.html',
    polyfills: ['zone.js'],
    styles: ['./src/styles.css'],
    tsConfig: './tsconfig.app.json',
    outputPath: '../../dist/apps/rspack-mfe1',
    // license-webpack-plugin cannot read Module Federation's synthetic
    // container modules: they have no resource path, so it scandirs ''.
    extractLicenses: false,
    devServer: {
      port: 4301,
    },
  },
}).then(applyFederation);
