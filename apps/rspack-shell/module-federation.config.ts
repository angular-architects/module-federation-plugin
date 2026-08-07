// See apps/rspack-mfe1/module-federation.config.ts for why this imports the
// built output instead of '@angular-architects/module-federation/rspack'.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { withFederation, shareAll } from '../../dist/libs/mf/rspack';

export default withFederation({
  options: {
    name: 'rspackShell',

    // No `remotes` here on purpose: this is a *dynamic* host. It learns about
    // rspack-mfe1 at runtime from public/mf.manifest.json, so remotes can be
    // added, moved or taken down without rebuilding the shell.
    shared: {
      ...shareAll({
        singleton: true,
        strictVersion: true,
        requiredVersion: 'auto',
      }),
    },
  },

  // Both sides have to agree on what is shared and what is skipped: a package
  // shared on one side and skipped on the other cannot resolve to a single
  // instance. See apps/rspack-mfe1/module-federation.config.ts.
  sharedMappings: ['@angular-architects/playground-lib'],

  skip: ['@rsbuild/core'],
});
