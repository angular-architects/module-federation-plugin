import { createConfig } from '@nx/angular-rspack';
import applyFederation from './module-federation.config';

export default createConfig({
  options: {
    browser: './src/main.ts',
    index: './src/index.html',
    polyfills: ['zone.js'],
    styles: ['./src/styles.css'],
    tsConfig: './tsconfig.app.json',
    outputPath: '../../dist/apps/rspack-shell',
    // Serves public/mf.manifest.json, which main.ts fetches before Angular boots.
    assets: [{ glob: '**/*', input: './public' }],
    extractLicenses: false,
    devServer: {
      port: 4300,
    },
  },
}).then(applyFederation);
