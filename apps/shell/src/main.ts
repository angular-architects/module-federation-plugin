import { initFederation } from '@angular-architects/module-federation';

// The manifest is a deployed asset, not a build-time constant — that is the
// whole point of a dynamic host. Nothing may import a shared library before
// this resolves, hence the dynamic import of ./bootstrap.
initFederation('mf.manifest.json')
  .catch((err) => console.error(err))
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
