# Native Federation

Native Federation is a "browser-native" implementation of the successful mental model behind wepback Module Federation for building Micro Frontends.

## Features

- ✅ Mental Model of Module Federation
- ✅ Future Proof: Independent of build tools like webpack
- ✅ Embraces Import Maps - an emerging web standard
- ✅ Easy to configure: We use the same API and Schematics as for our Module Federation plugin
- ✅ Blazing Fast: The reference implementation not only uses the fast esbuild; it also caches already built shared dependencies (like Angular itself).

## Today and Tomorrow

### Bundler

The current version uses **esbuild**. Future versions will allow to easily **switch out the build tool**.

### Frameworks

**Angular** is a first-class citizen: The package ships with **Schematics** for the Angular CLI and a **builder** (that delegates to the experimental esbuild builder the CLI team is current working on). Future versions will also make it easy to use the implementation **with other frameworks**.

### Design

This is possible, because by design, most of the implementation runs outside of the bundler und independently of CLI mechanisms. Hence, we will expose 2-3 helper functions everyone can call in their build process regardless of the framework or build tool used.

## Current Limitations

This is a first experimental version. The results look very promising, however it's not intended to be used in production. Feel free to try it out and to provide feedback!

Limitations:

- 🔷 As we use a fork of the experimental esbuild builder the CLI team is current working on, there is currently **only a builder for ng build**. ng serve or ng test are currently not supported. This support will be added with a future version. Also, as the forked esbuile builder is still experimental, you cannot expect to get all the features you are used to. This will also change over time.
- 🔷 Libraries are currently only shared if two or more remotes (Micro Frontends) request the very same version. This is also what works best with Angular. In a future version, we will add optional "version negotiation" for the sake of feature parity with Module Federation. This allows Native Federation to decide for a "higher compatible version" (e. g. a higher minor version provided by another Micro Frontend) at runtime.

## Credits

Big thanks to:

- [Zack Jackson](https://twitter.com/ScriptedAlchemy) for originally coming up with the great idea of Module Federation and its successful mental model
- [Tobias Koppers](https://twitter.com/wSokra) for helping to make Module Federation a first class citizen of webpack
- [Florian Rappl](https://twitter.com/FlorianRappl) for an good discussion about these topics during a speakers dinner in Nuremberg
- [The Nx Team](https://twitter.com/NxDevTools), esp. [Colum Ferry](https://twitter.com/FerryColum), who seamlessly integrated webpack Module Federation into Nx and hence helped to spread the word about it (Nx + Module Federation === ❤️)
- [Michael Egger-Zikes](https://twitter.com/MikeZks) for contributing to our Module Federation efforts and brining in valuable feedback
- The Angular CLI-Team, esp. [Alan Agius](https://twitter.com/AlanAgius4) and [Charles Lyding](https://twitter.com/charleslyding), for working on the experimental esbuild builder for Angular

## Example

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

Wait until the Micro Frontend is started.

Open another console and start the shell:

```
ng serve shell -o
```

## About the Mental Model

The underlying mental model allows for runtime integration: Loading a part of a separately built and deployed application into your's. This is needed for Micro Frontend architectures but also for plugin-based solutions.

For this, the mental model introduces several concepts:

- **Remote:** The remote is a separately built and deployed application. It can **expose EcmaScript** modules that can be loaded into other applications.
- **Host:** The host loads one or several remotes on demand. For your framework's perspective, this looks like traditional lazy loading. The big difference is that the host doesn't know the remotes at compilation time.
- **Shared Dependencies:** If a several remotes and the host use the same library, you might not want to download it several times. Instead, you might want to just download it once and share it at runtime. For this use case, the mental model allows for defining such shared dependencies.
- **Version Mismatch:** If two or more applications use a different version of the same shared library, we need to prevent a version mismatch. To deal with it, the mental model defines several strategies, like falling back to another version that fits the application, using a different compatible one (according to semantic versioning) or throwing an error.

## Usage/ Tutorial

You can checkout the [nf-standalone-starter branch](https://github.com/manfredsteyer/module-federation-plugin-example/tree/nf-standalone-starter) to try out Native Federation:

```
git clone https://github.com/manfredsteyer/module-federation-plugin-example.git --branch nf-standalone-starter

cd module-federation-plugin-example

npm i
```

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

The function points to a federation manifest. This manifest points to the individual Micro Frontends. It can be exchanged when deploying the solution. Hence, you can adopt the solution to the current environment.

**Credits:** The Nx team originally came up with the idea for the manifest.

This is what the (also generated) federation manifest (`projects\shell\src\assets\federation.manifest.json`) looks like:

```json
{
  "mfe1": "http://localhost:4201/remoteEntry.json"
}
```

Native Federation generates the `remoteEntry.json`. It contains metadata about the individual remote.

If you follow this tutorial, ensure this entry points to port `4201` (!).

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

Once, the remote is started, start the shell:

```
ng serve shell -o
```

## FAQ

### Should we Already use Native Federation in Production?

For production, we would stick with Module Federation for the time being. Native Federation, however, shows that you don't need to fear that you are left alone, once you (or the community) wants to move over to other build tools.

We will evolve Native Federation but also our Module Federation support and keep you posted.

### How does Native Federation Work under the Covers?

We use Import Maps at runtime. As they are currently not supported in every browser, our `init` schematic installs the `es-module-shims` polyfill. In addition to Import Maps, we use some code at build time and at runtime to provide the Mental Model of Module Federation.

## More: Blog Articles

Find out more about our work including Micro Frontends and Module Federation but also about alternatives to these approaches in our [blog](https://www.angulararchitects.io/en/aktuelles/the-microfrontend-revolution-part-2-module-federation-with-angular/).

## More: Angular Architecture Workshop (100% online, interactive)

In our [Angular Architecture Workshop](https://www.angulararchitects.io/en/angular-workshops/advanced-angular-enterprise-architecture-incl-ivy/), we cover all these topics and far more. We provide different options and alternatives and show up their consequences.

[Details: Angular Architecture Workshop](https://www.angulararchitects.io/en/angular-workshops/advanced-angular-enterprise-architecture-incl-ivy/)
