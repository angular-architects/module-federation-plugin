const path = require('path');

// See apps/mfe1/webpack.config.js for why this requires the built output
// instead of '@angular-architects/module-federation/webpack'.
const {
  shareAll,
  withModuleFederationPlugin,
} = require('../../dist/libs/mf/webpack');

// No `remotes` here on purpose: this is a *dynamic* host. It learns about mfe1
// and mfe2 at runtime from public/mf.manifest.json, so remotes can be added,
// moved or taken down without rebuilding the shell.
const config = withModuleFederationPlugin({
  name: 'shell',

  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
  },

  sharedMappings: ['@angular-architects/playground-lib'],
});

// In-repo demo only. Angular's webpack build resolves bare specifiers from
// node_modules and ignores tsconfig `paths`, and this repo never installs its
// own package. These mirror the two `paths` entries the shell relies on.
// They must point at sources, not dist/: building `mf` also rebuilds
// `mf-runtime`, and ng-packagr recreates dist/libs/mf-runtime — which would
// yank the module out from under a dev-server that is already watching it.
const lib = (p) => path.join(__dirname, '../..', p);
Object.assign(config.resolve.alias, {
  '@angular-architects/module-federation': lib('libs/mf/src/index.ts'),
  '@angular-architects/module-federation-runtime': lib(
    'libs/mf-runtime/src/index.ts',
  ),
});

module.exports = config;
