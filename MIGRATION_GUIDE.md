# Migration guide

The goal of this small guide is to show the major differences between Native federation v3 and v4. This guide is only for people who want to mess around with the **beta** release, and it expects a (monorepo) setup that contains 1 or multiple Angular micro frontends.

The migration involves changing 4 files:

```
📁 /
├── 📄 package.json                     // Enabling ESM
├── 📄 angular.json                     // Switching to the v4 builder
└── 📁 projects/
    └── 📁 <your-project>/
        ├── 📄 federation.config.json   // Switching from commonJS to ESM
        └── 📁 src/
            └── 📄 main.ts              // optionally: switching to the orchestrator
```

## 0. Removing cache

Just to be sure, delete these folders to avoid corrupted caches:

```
📁 /
├── 📁 .angular/            // Angular cache
├── 📁 dist/                // Previously bundled artifacts
└── 📁 node_modules/
    └── 📁 .cache/          // Native federation cache
```

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
    "@softarc/native-federation-runtime": "4.0.0-RC6" // Lock the version to the v4 RC6
  },
  "devDependencies": {
    "@angular-architects/native-federation-v4": "^21.1.4", // Switch over to the (temporary) v4 package
    "@softarc/native-federation": "4.0.0-RC6", // Lock the version to the v4 RC6
    "@softarc/native-federation-orchestrator": "4.0.0-RC4" // Lock the version to the v4 RC4
  }
}
```

## 2. Updating the federation.config.js

The `federation.config.js` contains all native-federation related configuration. You don't really need to change it, except for the format. It used to be CommonJS and has been changed to ESM as well for consistency:

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
// Our well-known ESM importing types
import { withNativeFederation, shareAll } from '@softarc/native-federation/config';

// change this line to the default export.
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

## 3. Updating the angular.json

In the new version we're moving to an opt-in setup where the user (you) can customize and choose whatever features you prefer! All these options will be defined in the angular.json:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "mfe1": {
      "projectType": "application",
      "schematics": {
        "@schematics/angular:component": {
          "style": "scss"
        }
      },
      "root": "projects/mfe1",
      "sourceRoot": "projects/mfe1/src",
      "prefix": "app",
      "architect": {
        "serve": {
          // Of course, make sure you're using the v4 builder if not already!  (for "serve" and "build")
          "builder": "@angular-architects/native-federation-v4:build",
          "options": {
            "target": "mfe1:serve-original:development",
            "cacheExternalArtifacts": true, // Cache and re-use external bundled artifacts that don't change (e.g. RxJs) across builds
            "rebuildDelay": 500, // Allows for a grace period between builds when you develop; within this period it can cancel previous builds to save time (500/1000 is good)
            "chunks": { "enable": true, "dense": true }, // Enabling code splitting. The default is true, but dense mode is opt-in (so false by default).
            "dev": true,
            "port": 0
          }
        }
      }
    }
  }
}
```

Dense mode is something new in v4 that is experimental! Read more about it here: https://github.com/native-federation/native-federation-core/issues/5

And that's it! Your micro frontend is migrated to the new major! We do have some optional improvements that can be nice:

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

The runtime you see here is the "legacy runtime" that did the job. But it lacks some modern features like dependency sharing based on a range, shareScopes, in-browser caching etc etc. That's why from now on we recommend the orchestrator!

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

Not a lot of changes right? Sure, now you need to explicitly define the location of the manifest (or the object), but for the rest it's basically the same!

Now, the big difference is that the new orchestrator is a _lot_ more customizable:

```javascript
import { initFederation, NativeFederationResult } from '@softarc/native-federation-orchestrator';
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
})
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

You see that? Now you can choose which logger you want, and if you want to use the "shimImportMap" instead of the browser-native importmap (spoiler alert: 90% chance you do).

There's a nice list of all the options you can choose from in the docs: https://github.com/native-federation/orchestrator/blob/main/docs/config.md

### We've reworked the loadRemoteModule function

The biggest change is that now, the loadRemoteModule is provided by initFederation. So it's not a global export anymore. That does mean that you now need to pass it around your micro frontends:

**(host) main.ts**

```javascript
import { initFederation, NativeFederationResult } from '@softarc/native-federation-orchestrator';

const manifest = {
  mfe1: 'http://localhost:4201/remoteEntry.json',
};

initFederation(manifest)
  .then(({ loadRemoteModule }: NativeFederationResult) => {
    return import('./bootstrap').then((m: any) => m.bootstrap(loadRemoteModule));
  })
  .catch(err => console.error(err));
```

Now you can set up a bootstrap.ts that exposes a method "bootstrap" that accepts this function.

**(mfe1) bootstrap.ts**

```javascript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { LoadRemoteModule } from '@softarc/native-federation-orchestrator';

export const bootstrap = (loadRemoteModule: LoadRemoteModule) =>
  bootstrapApplication(AppComponent, appConfig(loadRemoteModule)).catch(err => console.error(err));
```

And ofcourse the **app.config.ts:**

```javascript
import {
  ApplicationConfig,
  InjectionToken,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, Routes } from '@angular/router';
import { LoadRemoteModule, NativeFederationResult } from '@softarc/native-federation-orchestrator';

export const MODULE_LOADER = new InjectionToken<LoadRemoteModule>(
  'loader',
);

const routes = (loadRemoteModule: LoadRemoteModule): Routes => [
  {
    path: 'mfe3',
    loadComponent: () =>
      loadRemoteModule('mfe3', './Component')
        .then((m:any) => m.AppComponent),
  }
];

export const appConfig = (loadRemoteModule: LoadRemoteModule): ApplicationConfig => ({
  providers: [
    { provide: MODULE_LOADER, useValue: loadRemoteModule },
    provideZonelessChangeDetection(),
    provideRouter(routes(loadRemoteModule)),
  ],
});
```

While this does create a bit more boilerplate and complexity, the nice benefit is a controlled flow in which the loadRemoteModule is only available after federation is initialized.

## That's it

We've been scratching the surface here, but these are the essentials to migrate your codebase to the new major!

Feel free to open an issue if you come across any problems or if we've missed anything.
