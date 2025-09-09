# Native Federation for Angular

Native Federation is a "browser-native" implementation of the successful mental model behind webpack Module Federation for building Micro Frontends (Plugins, etc.).

## Features 🔥

- ✅ Mental Model of Module Federation
- ✅ Future Proof: Uses **Web Standards** to be **independent** of build tools like webpack
- ✅ Neat Angular-Integration: **Directly delegates** to Angular's new ultra-fast esbuild-based ApplicationBuilder to **prevent diverging** from the Angular standard.

### More

- ✅ Embraces ESM and Import Maps - an emerging web standard
- ✅ Easy to configure: We use the same API and Schematics as for our Module Federation plugin
- ✅ Blazing Fast: The reference implementation not only uses the fast esbuild; it also caches already built shared dependencies.
- ✅ Supports Angular SSR and Incremental Hydration (since 18@latest)
- ✅ Supports Angular I18N (since 19.0.13)

## Prerequisite

Angular & Angular CLI 16.1 or higher

This package was successfully tested with Angular CLI projects and with Nx projects.

## Versions

We will at least provide a new version of this package per Angular major. If necessary, we will also provide packages to adapt to Angular minors. To make the relationship between Angular versions and versions of this package easy for all of us, **we follow Angular's version numbers**. E. g., `@angular-architects/native-federation` 16.1 is intended for Angular 16.1 and upwards.

- Use version 16.1.x for Angular 16.1.x
- Use version 16.2.x for Angular 16.2.x
- Use version 17.x for Angular 17.x
- Use version 17.1.x for Angular 17.1
- Use version 18.x for Angular 18.0.x
- Use version 18.1.x for Angular 18.1.x
- Use version 18.2.x for Angular 18.2.x
- Use version 19.x for Angular 19.x
- Use version 20.0.x for Angular 20.0.x
- Use version 20.1.x for Angular 20.1.x

## Demo Repo

In this [demo repo](https://github.com/manfredsteyer/nf-test.git), we test Native Federation together with several known UI libraries for Angular. For this, we compile demo apps build with them with Native Federation.

<a href="https://github.com/manfredsteyer/nf-test.git" target="_blank">
<img width="500" src="https://github.com/angular-architects/module-federation-plugin/blob/main/libs/native-federation/demo-repo.png">
</a>

This is primarily for testing purposes. For an **initial example and/or an tutorial please look below.**

## Migration from Module Federation

If you currently use Angular with Module Federation, you can follow our [Migration Guide](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/native-federation/docs/migrate.md) to migrate to Native Federation and Angular's new fast esbuild-based build system.

## Using Module Federation and Native Federation Side-by-Side

[In this article](https://www.angulararchitects.io/en/blog/combining-native-federation-and-module-federation/) we describe, how to use both technologies side-by-side.

## Updates

You can use `ng update` for updating Native Federation.

Notes for [updating to version 18](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/native-federation/docs/update18.md)

## Angular Integration

Since 17.1, Native Federation for Angular uses the Angular CLI's `esbuild`-based **Application Builder** and the CLI's **Dev Server** to **keep track with all the innovations and performance-improvements provided by the Angular CLI team.**

Please find some [information for upgrading to 17.1. here](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/native-federation/migrate-appbuilder.md).

## Credits

Big thanks to:

- [Zack Jackson](https://twitter.com/ScriptedAlchemy) for initially coming up with the great idea of Module Federation and its successful mental model
- [Tobias Koppers](https://twitter.com/wSokra) for helping to make Module Federation a first class citizen of webpack
- [Florian Rappl](https://twitter.com/FlorianRappl) for a good discussion about these topics during a speakers dinner in Nuremberg
- [The Nx Team](https://twitter.com/NxDevTools), esp. [Colum Ferry](https://twitter.com/FerryColum), who seamlessly integrated webpack Module Federation into Nx and hence helped to spread the word about it (Nx + Module Federation === ❤️)
- [Michael Egger-Zikes](https://twitter.com/MikeZks) for contributing to our Module Federation efforts and brining in valuable feedback
- The Angular CLI-Team, esp. [Alan Agius](https://twitter.com/AlanAgius4) and Charles Lyding, for their fantastic work on the esbuild builder for Angular

## Example 🛠️

We migrated our webpack Module Federation example to Native Federation:

![Example](https://raw.githubusercontent.com/angular-architects/module-federation-plugin/main/libs/native-federation/example.png)

Please find the example [here (branch: nf-standalone-solution)](https://github.com/manfredsteyer/module-federation-plugin-example/tree/nf-standalone-solution):

```
git clone https://github.com/manfredsteyer/module-federation-plugin-example.git --branch nf-standalone-solution

cd module-federation-plugin-example

npm i
```

Start the Micro Frontend:

```
ng serve mfe1 -o
```

_(In the case of an error, see this [information below](#error-file-srcmaints-is-missing-from-the-typescript-compilation-plugin-angular-compiler))_

Wait until the Micro Frontend is started.

Open another console and start the shell:

```
ng serve shell -o
```

The example loads a Micro Frontends into a shell:

![Microfrontend Loaded into Shell](https://github.com/angular-architects/module-federation-plugin/raw/main/libs/mf/tutorial/result.png)

## Relationship to @angular-architects/module-federation

This package, `@angular-architects/native-federation`, uses the same API as `@angular-architects/module-federation`. To switch over, just make sure you import everything from the former package. Don't mix these packages.

## About the Mental Model 🧠

The underlying mental model allows for runtime integration: Loading a part of a separately built and deployed application into yours. This is needed for Micro Frontend architectures but also for plugin-based solutions.

For this, the mental model introduces several concepts:

- **Remote:** The remote is a separately built and deployed application. It can **expose EcmaScript** modules that can be loaded into other applications.
- **Host:** The host loads one or several remotes on demand. From your framework's perspective, this looks like traditional lazy loading. The big difference is that the host doesn't know the remotes at compilation time.
- **Shared Dependencies**:\*\* If several remotes and the host use the same library, you might not want to download it several times. Instead, you might want to download it once and share it at runtime. For this use case, the mental model allows for defining such shared dependencies.
- **Version Mismatch:** If two or more applications use a different version of the same shared library, we need to prevent a version mismatch. The mental model defines several strategies to deal with it, like falling back to another version that fits the application, using a different compatible one (according to semantic versioning), or throwing an error.

## Usage/ Tutorial 🧪

You can checkout the [nf-standalone-starter branch](https://github.com/manfredsteyer/module-federation-plugin-example/tree/nf-standalone-starter) to try out Native Federation:

```
git clone https://github.com/manfredsteyer/module-federation-plugin-example.git --branch nf-standalone-starter

cd module-federation-plugin-example

npm i
```

This repository consists of two Angular applications: a `shell` and a Micro Frontend called `mfe1`. During this tutorial, you will load `mfe1` into the `shell`:

![Microfrontend Loaded into Shell](https://github.com/angular-architects/module-federation-plugin/raw/main/libs/mf/tutorial/result.png)

### Adding Native Federation

```
npm i @angular-architects/native-federation -D
```

Making an application a remote (Micro Frontend):

```
ng g @angular-architects/native-federation:init --project mfe1 --port 4201 --type remote
```

Making an application a host (shell):

```
ng g @angular-architects/native-federation:init --project shell --port 4200 --type dynamic-host
```

A dynamic host reads the configuration data at runtime from a `.json` file.

> The schematics called here automate most steps of this tutorial, esp. adding configuration files and bootstrapping Native Federation. Hence, the following sections primarily discuss these changes. You just need to add a lazy route (see below) and make sure the correct ports are configured in the federation manifest (see below too).

### Configuring the Host

The host configuration (`projects/shell/federation.config.js`) looks like what you know from our Module Federation plugin:

```javascript
const {
  withNativeFederation,
  shareAll,
} = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Add further packages you don't need at runtime
  ],
});
```

> Our `init` schematic shown above generates this file for you.

### Configuring the Remote

Also, the remote configuration (`projects/mfe1/federation.config.js`) looks familiar:

```javascript
const {
  withNativeFederation,
  shareAll,
} = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
  name: 'mfe1',

  exposes: {
    './Component': './projects/mfe1/src/app/app.component.ts',
  },

  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
  },

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
    // Add further packages you don't need at runtime
  ],
});
```

> Our `init` schematic shown above generates this file for you.

### Initializing the Host

When bootstrapping the host (shell), Native Federation (`projects\shell\src\main.ts`) is initialized:

```typescript
import { initFederation } from '@angular-architects/native-federation';

initFederation('/assets/federation.manifest.json')
  .catch((err) => console.error(err))
  .then((_) => import('./bootstrap'))
  .catch((err) => console.error(err));
```

> This file is generated by the schematic described above.

The function points to a federation manifest. This manifest lists the individual remotes. It can be exchanged when deploying the solution. Hence, you can adapt the build to the respective environment.

**Credits:** The Nx team originally came up with the idea for the manifest.

This is what the (also generated) federation manifest (`projects\shell\src\assets\federation.manifest.json`) looks like:

```json
{
  "mfe1": "http://localhost:4201/remoteEntry.json"
}
```

Native Federation generates the `remoteEntry.json`. It contains metadata about the individual remote.

If you follow this tutorial, **ensure** this entry points to port `4201` (!).

### Initializing the Remote

When bootstrapping your remote (`projects\mfe1\src\main.ts`), Native Federation is initialized too:

```typescript
import { initFederation } from '@angular-architects/native-federation';

initFederation()
  .catch((err) => console.error(err))
  .then((_) => import('./bootstrap'))
  .catch((err) => console.error(err));
```

> Our `init` schematic shown above also generates this file.

After the initialization, it loads the file `bootstrap.ts` starting your Angular application.

### Loading a Remote

For loading a component (or any other building block) exposed by a remote into the host, use Native Federation's `loadRemoteModule` function together with lazy loading (`projects\shell\src\app\app.routes.ts`):

```typescript
import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { NotFoundComponent } from './not-found/not-found.component';

// Add this import:
import { loadRemoteModule } from '@angular-architects/native-federation';

export const APP_ROUTES: Routes = [
  {
    path: '',
    component: HomeComponent,
    pathMatch: 'full',
  },

  // Add this route:
  {
    path: 'flights',
    loadComponent: () =>
      loadRemoteModule('mfe1', './Component').then((m) => m.AppComponent),
  },

  {
    path: '**',
    component: NotFoundComponent,
  },

  // DO NOT insert routes after this one.
  // { path:'**', ...} needs to be the LAST one.
];
```

### Starting your example

Start the remote:

```
ng serve mfe1 -o
```

_(In the case of an error, see this [information below](#error-file-srcmaints-is-missing-from-the-typescript-compilation-plugin-angular-compiler))_

Once the remote is started, start the shell:

```
ng serve shell -o
```

Now, by clicking at the 2nd menu item, you can load the remote directly into the host.

## Advanced Use Cases

### SSR and Hydration

We support Angular's SSR and (Incremental) Hydration. Please find [more information here](https://www.angulararchitects.io/blog/ssr-and-hydration-with-native-federation-for-angular/).

### Native Federation and Module Federation

We support combining Native Federation with Module Federation. Please find [more information here](https://www.angulararchitects.io/blog/combining-native-federation-and-module-federation/).

### Angular I18N

Since version 19.0.13, Native Federation for Angular supports Angular I18N. Here are some things to keep in mind:

- Make sure, you also add I18N support to your shell (e.g., `ng add @angular/localize --project shell`)
- Configure I18N in your `angular.json`. Don't use command line parameters (as the Native Federation Builder does not forward them to the ApplicationBuilder by design)
- In production, make sure your `federation.manifest.json` points to the right language versions of your remotes

### Angular Localization

#### Out of the box

Since version 20.0.6, loading locales works out of the box, when the feature `ignoreUnusedDeps` is activated:

```js
features: {
  ignoreUnusedDeps: true;
}
```

For new projects, this setting is generated by default.

#### Fallback

Before version 20.0.6 or when `ignoreUnusedDeps` is not activated, you need a helper that only loads the needed localization files:

```js
module.exports = withNativeFederation({
  [...],
  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
    ...shareAngularLocales(['en', 'de', 'fr']),
  }
});
```

This option was introduced with version 19.0.14.

#### Shell reloading when MFE finishes building for local development

Native Federation provides automatic shell reloading when remote Micro Frontends finish rebuilding during development. This feature eliminates manual page refreshes and significantly improves the development experience when working with multiple applications simultaneously.

For complete implementation details, configuration options, please refer to the article:

**📖 [Fixing DX Friction: Automatic Shell Reloading in Native Federation](https://www.angulararchitects.io/en/blog/fixing-dx-friction-automatic-shell-reloading-in-native-federation/)**

## FAQ

### When to use this package?

If you like the idea of webpack Module Federation but want to switch over to Angular's new esbuild builder, you can use this package.

### I get an error when preparing shared packages. What to do?

Native Federation needs to prepare all your shared packages so that it can load them on demand as EcmaScript modules. This only happens once for development and once for production builds. The result of this is cached.

If the preparation of one of these packages fails, you get an error like this one:

![error when preparing shared packages](https://github.com/angular-architects/module-federation-plugin/blob/main/error.png?raw=true)

For this, there are several reasons:

- Perhaps you try to share a package intended for NodeJS/ a package that cannot be converted to EcmaScript modules. This happens if you use `shareAll` in the `federation.config.js` and when the package in question is part of your dependencies in `package.json`. If you don't need (to share) this package at runtime, move it to `devDependencies` or add it to the `skip` section of your `federation.config.js`.

- Perhaps your shared packages contain some code esbuild cannot transfer to EcmaScript modules. This should not be the case for packages, built with the Angular CLI or Nx and the underlying package ng-packagr. If this happens, please let us know about the package causing troubles.

### How to deal with CommonJS Packages?

The good message is, that the official Angular Package Format defines the usage of ECMA Script Modules (ESM) for years. This is the future-proof standard, Native Federation is built upon and all npm packages created with the Angular CLI follow. If you use older CommonJS-based packages, Native Federation automatically converts them to ESM. Depending on the package, this might change some details. Here, you find some [information for dealing with CommonJS packages](https://shorturl.at/jmzH0).

### How to Manually Define a Package's Entry Point?

Usually, Native Federation automatically detects entry points in shared packages. If the packages neither align with the official standard nor with typical conventions beyond these standards, you can also directly provide the entry point:

```js
module.exports = withNativeFederation({
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
    'test-pkg': {
      packageInfo: {
        entryPoint: '/path/to/test-pkg/entry.mjs',
        version: '1.0.0',
        esm: true,
      },
    },
  },
});
```

As in such cases, we cannot expect to find a `package.json` nearby, you also have to specifiy the `version` and the `esm` flag by hand.

### How to speed up package preparation during the build process

The already prepared packages are cached in `node_modules/.cache`. Make sure, this folder is reused across subsequent build process runs.

### How does Native Federation Work under the Covers?

We use Import Maps at runtime. In addition to Import Maps, we use some code at build time and at runtime to provide the Mental Model of Module Federation.

## Documentation 📰

Please have a look at this [article series](https://www.angulararchitects.io/en/aktuelles/the-microfrontend-revolution-part-2-module-federation-with-angular/).

Even though these articles were written for Module Federation, thanks to the same API, they also apply to Native Federation.

## More: Angular Architecture Workshop (100% online, interactive)

In our [Angular Architecture Workshop](https://www.angulararchitects.io/en/angular-workshops/advanced-angular-enterprise-architecture-incl-ivy/), we cover all these topics and far more. We provide different options and alternatives and show up their consequences.

[Details: Angular Architecture Workshop](https://www.angulararchitects.io/en/angular-workshops/advanced-angular-enterprise-architecture-incl-ivy/)
