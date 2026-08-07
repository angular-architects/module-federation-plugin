// See apps/mfe1/webpack.config.js for why this requires the built output
// instead of '@angular-architects/module-federation/webpack'.
const {
  shareAll,
  withModuleFederationPlugin,
} = require('../../dist/libs/mf/webpack');

module.exports = withModuleFederationPlugin({
  name: 'mfe2',

  // mfe1 exposes routes, mfe2 exposes a single component — both are valid
  // granularities and the shell consumes them differently.
  exposes: {
    './Component': './apps/mfe2/src/app/dashboard/dashboard.component.ts',
  },

  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
  },

  sharedMappings: ['@angular-architects/playground-lib'],
});
