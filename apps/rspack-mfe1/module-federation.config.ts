// In a normal app this is `require('@angular-architects/module-federation/rspack')`.
// Inside this repo the package isn't installed, so we point at the built output —
// the `build` target depends on `mf:build` to make sure it's there.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { withFederation, shareAll } from '../../dist/libs/mf/rspack';

export default withFederation({
  options: {
    // The MF runtime resolves remotes by name, so this has to match the key
    // under which rspack-shell's mf.manifest.json lists this remote.
    name: 'rspackMfe1',

    exposes: {
      './routes': './src/app/flights/flights.routes.ts',
      './Component': './src/app/dashboard/dashboard.component.ts',
    },

    shared: {
      ...shareAll({
        singleton: true,
        strictVersion: true,
        requiredVersion: 'auto',
      }),
    },
  },

  // Without this, every non-wildcard `paths` entry in the root tsconfig is
  // shared — including this repo's own plugin packages and a few dead entries.
  sharedMappings: ['@angular-architects/playground-lib'],

  // Must match rspack-shell's skip list: a package skipped on one side and
  // shared on the other cannot resolve to a single instance.
  skip: [
    // A build-time dependency of this repo, so `shareAll()` picks it up. A
    // normal app doesn't depend on it and so never notices.
    '@rsbuild/core',
  ],
});
