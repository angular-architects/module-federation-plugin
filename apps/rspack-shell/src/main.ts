// In a normal app this is '@angular-architects/module-federation/runtime'. That
// entry point maps to the *enhanced* runtime, which is the one the rspack
// integration needs — it drives @module-federation/enhanced rather than the
// classic __webpack_share_scopes__ globals the webpack demo uses.
import { initFederation } from '@angular-architects/module-federation-runtime/enhanced';

// The manifest is a deployed asset, not a build-time constant — that is the
// whole point of a dynamic host. Nothing may import a shared library before
// the remotes are registered, hence the dynamic import of ./bootstrap.
initFederation('mf.manifest.json')
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
