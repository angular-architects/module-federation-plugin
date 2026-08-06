// In a normal app this is `require('@angular-architects/module-federation/webpack')`.
// Inside this repo the package isn't installed, so we point at the built output —
// `nx build mfe1` depends on `mf:build` to make sure it's there.
const {
  shareAll,
  withModuleFederationPlugin,
} = require('../../dist/libs/mf/webpack');

module.exports = withModuleFederationPlugin({
  name: 'mfe1',

  exposes: {
    './routes': './apps/mfe1/src/app/flights/flights.routes.ts',
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
