# Migration guide

The goal of this small guide is to show the major differences between Native federation v3 and v4. This guide is only for people who want to mess around with the **beta** release and expects a (monorepo) setup that contains 1 or multiple Angular micro frontends.

## 1. Updating the package.json

The first step is to update the `package.json` to install the new packages:

```json
{
  "name": "mfe-test",
  "version": "1.2.3",
  "type": "module", //  <-- Very important! we're fully ESM now!
  "scripts": {
    "ng": "ng"
  },
  "private": true,
  "dependencies": {
    // [...] Dependencies
    "@softarc/native-federation-runtime": "4.0.0-RC5" // Lock the version to the v4 RC5
  },
  "devDependencies": {
    "@angular-architects/native-federation-v4": "^21.1.4", // Switch over to the (temporary) v4 package
    "@softarc/native-federation": "4.0.0-RC5", // Lock the version to the v4 RC5
    "@softarc/native-federation-orchestrator": "4.0.0-RC4" // Lock the version to the v4 RC4
  }
}
```

## 2. Updating the federation.config.js

The `federation.config.js` contains all native-federation related configuration. You don't really need to change it, except for the format. It used to be commonjs and has been changed to ESM as well for consistency:

**Before:**

```javascript
// Notice the require? we're going to change that for import!
const { withNativeFederation, share, shareAll } = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({

  name: 'mfe1',

  exposes: {
    './Component': './projects/mfe1/src/bootstrap.ts',
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),

    // This example is only for setups that have a share after the shareAll as you can see here.
    ...share({ "@angular/core": { singleton: true, strictVersion: true, requiredVersion: 'auto' }});
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Add further packages you don't need at runtime
  ]

  // Please read our FAQ about sharing libs:
  // https://shorturl.at/jmzH0

});
```

**After:**

```javascript
import { withNativeFederation, shareAll } from '@softarc/native-federation/config';

export default withNativeFederation({
  name: 'team/mfe1',

  exposes: {
    './Component': './projects/mfe1/src/bootstrap.ts',
  },
  shared: {
    // This still works! But how about overrides?
    // ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),

    // Here's an alternative, you can merge the overrides _into_ the shareAll!
    ...shareAll(
      { singleton: true, strictVersion: true, requiredVersion: 'auto' },
      {
        overrides: {
          '@angular/core': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: { keepAll: true },
          },
          '@angular/common': {
            singleton: true,
            strictVersion: true,
            requiredVersion: 'auto',
            includeSecondaries: { keepAll: true },
          },
        },
      }
    ),
  },

  skip: ['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket'],

  features: {
    ignoreUnusedDeps: true,
  },
});
```

And that's it! Your micro frontend is migrated to the new Major! We do have some optional improvements that can be nice:

## Optional: using the orchestrator instead

Here's the `projects/<your-project>/src/main.ts` you've been used to for the last couple of years:

```javascript
import { initFederation } from '@angular-architects/native-federation';

initFederation()
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

We're changing that to the code you're _actually_ using:

```javascript
import { initFederation } from '@softarc/native-federation-runtime'; // Default native-federation runtime

initFederation()
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

Now, this is the legacy runtime that did the job. But it lacks some modern features like dependency sharing based on a range, shareScopes, in-browser caching etc etc. That's why from now on we recommend the orchestrator!

```javascript
import { initFederation, NativeFederationResult } from '@softarc/native-federation-orchestrator';

const manifest = {
  mfe1: 'http://localhost:4201/remoteEntry.json',
};

initFederation(manifest)
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

Not a lot of changes right? Sure, now you need to explicitly define the location of the manifest (or the object) but for the rest it's basically the same!

Now, the big difference is that the new orchestrator is a _lot_ more customizable:

```
import {
  initFederation,
  NativeFederationResult,
} from '@softarc/native-federation-orchestrator';
import {
  useShimImportMap,
  consoleLogger,
  globalThisStorageEntry,
} from '@softarc/native-federation-orchestrator/options';

const manifest = {
  mfe1: 'http://localhost:4201/remoteEntry.json',
};

initFederation(manifest, {
  ...useShimImportMap({ shimMode: true }),
  logger: consoleLogger,
  storage: globalThisStorageEntry,
  hostRemoteEntry: './remoteEntry.json',
  logLevel: 'debug',
  profile: {
    latestSharedExternal: false,
    overrideCachedRemotesIfURLMatches: true,
  },
})
  .catch((err) => console.error(err))
  .then((_) => import('./bootstrap'))
  .catch((err) => console.error(err));
```

You see that? now you can choose which logger you want, if you want to use the "shimImportMap" instead of the browser-native importmap (spoiler alert: 90% chance you do). There is a nice list of all the options you can choose from right here: https://github.com/native-federation/orchestrator/blob/main/docs/config.md
