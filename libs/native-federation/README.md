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

- 🔷 As we use a fork of the experimental esbuild builder the CLI team is current working on, there is currently **only a builder for ng build**. ng serve or ng test are currently not supported. This support will be added with a future version.
  
- 🔷 Libraries are currently only shared if two or more remotes (Micro Frontends) request the very same version. This is also what works best with Angular. In a future version, we will add optional "version negotiation" for the sake of feature parity with Module Federation. This allows Native Federation to decide for a "higher compatible version" (e. g. a higher minor version provided by another Micro Frontend) at runtime.

## Credits

Big thanks to:

- [Zack Jackson](https://twitter.com/ScriptedAlchemy) for originally coming up with the great idea of Module Federation and its successful mental model
- [Tobias Koppers](https://twitter.com/wSokra) for helping to make Module Federation a first class citizen of webpack
- [The Nx Team](https://twitter.com/NxDevTools), esp. [Colum Ferry](https://twitter.com/FerryColum), who seamlessly integrated webpack Module Federation into Nx and hence helped to spread the word about it (Nx + Module Federation === ❤️)
- [Michael Egger-Zikes](https://twitter.com/MikeZks) for contributing to our Module Federation efforts and brining in valuable feedback
- The Angular CLI-Team, esp. [Alan Agius](https://twitter.com/AlanAgius4) and [Charles Lyding](https://twitter.com/charleslyding), for working on the experimental esbuild builder for Angular

## Example

We migrated our webpack Module Federation example to Native Federation:

![Example](https://raw.githubusercontent.com/angular-architects/module-federation-plugin/main/libs/native-federation/example.png)

Please find the example [here (branch: ng-solution)](https://github.com/manfredsteyer/module-federation-plugin-example/tree/nf-solution):

```
git clone https://github.com/manfredsteyer/module-federation-plugin-example.git --branch nf-solution

cd module-federation-plugin-example

npm i
npm run build
npm start
```

Then, open http://localhost:3000 in your browser.

Please note, that the current **experimental** version does **not** support ``ng serve``. Hence, you need to build it and serve it from the ``dist`` folder (this is what npm run build && npm run start in the above shown example do).

## Usage

> You can checkout the [nf-starter branch](https://github.com/manfredsteyer/module-federation-plugin-example/tree/nf-solution) to try out Native Federation.

### Adding Native Federation

```
npm i @angular-architects/native-federation -D
```

Making an application a host:

```
ng g @angular-architects/native-federation:init --project shell --type host
```

A dynamic host is a host reading the configuration data at runtime from a ``.json`` file:

```
ng g @angular-architects/native-federation:init --project shell --type dynamic-host
```

Making an application a remote:

```
ng g @angular-architects/native-federation:init --project mfe1 --type remote
```

### Configuring the Host

The host configuration looks like what you know from our Module Federation plugin:

```javascript
// projects/shell/federation.config.js

const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },

});
```

### Configuring the Remote

Also the remote configuration looks familiar:

```javascript
// projects/mfe1/federation.config.js

const { withNativeFederation, shareAll } = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({

  name: 'mfe1',

  exposes: {
    './Module': './projects/mfe1/src/app/flights/flights.module.ts',
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },

});
```

### Initializing the Host

Call ``initFederation`` before bootstrapping your ``main.ts``:

```typescript
// projects/shell/src/main.ts

import { initFederation } from '@angular-architects/native-federation';

initFederation({
	mfe1: 'http://localhost:3001/remoteEntry.json'
})
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

> Our ``init`` schematic shown above generates all of this if you pass ``--type host``.

You can directly pass a mapping between remote names and their ``remoteEntry.json``. The ``remoteEntry.json`` contains the necessary metadata. It is generated when compiling the remote.

Please note that in Native Federation, the remote entry is just a ``.json`` file while its a ``.js`` file in Module Federation.

However, you don't need to hardcode this mapping. Feel free to point to the file name of a federation manifest:

```typescript
// projects/shell/src/main.ts

import { initFederation } from '@angular-architects/native-federation';

initFederation('/assets/federation.manifest.json')
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

This manifest can be exchanged when deploying the solution. Hence, you can adopt the solution to the current environment.

> Our ``init`` schematic shown above generates this variation if you pass ``--type dynamic-host``.

Credits: The Nx team originally came up with the idea for the manifest.

This is what the (also generated) federation manifest looks like:

```json
{
	"mfe1": "http://localhost:3001/remoteEntry.json"
}
```

### Initializing the Remote

Also, the remote needs to be initialized. If a remote doesn't load further remotes, you don't need to pass any mappings to ``initFederation``:

```typescript
import { initFederation } from '@angular-architects/native-federation';

initFederation()
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
```

### Loading a Remote

Use the helper function ``loadRemoteModule`` to load a configured remote:

```typescript
import { loadRemoteModule } from '@angular-architects/native-federation';
[...]

export const APP_ROUTES: Routes = [
    [...]

    {
      path: 'flights',
      loadChildren: () => loadRemoteModule({
          remoteName: 'mfe1',
          exposedModule: './Module'
        }).then(m => m.FlightsModule)
    },

    [...]
}
```

This can be used with and without routing; with ``NgModule``s but also with **standalone** building blocks. Just use it instead of dynamic imports.

For the sake of compatibility with our Module Federation API, you can also use the ``remoteEntry`` to identify the remote in question:

```typescript
import { loadRemoteModule } from '@angular-architects/native-federation';
[...]

export const APP_ROUTES: Routes = [
    [...]

    {
      path: 'flights',
      loadChildren: () => loadRemoteModule({
          // Alternative: You can also use the remoteEntry i/o the remoteName:
          remoteEntry: 'http://localhost:3001/remoteEntry.json',
          exposedModule: './Module'
        }).then(m => m.FlightsModule)
    },

    [...]
}
```

However, we prefer the first option where just the ``remoteName`` is passed.

## More: Blog Articles

Find out more about our work including Micro Frontends and Module Federation but also about alternatives to these approaches in our [blog](https://www.angulararchitects.io/en/aktuelles/the-microfrontend-revolution-part-2-module-federation-with-angular/).

## More: Angular Architecture Workshop (100% online, interactive)

In our [Angular Architecture Workshop](https://www.angulararchitects.io/en/angular-workshops/advanced-angular-enterprise-architecture-incl-ivy/), we cover all these topics and far more. We provide different options and alternatives and show up their consequences.

[Details: Angular Architecture Workshop](https://www.angulararchitects.io/en/angular-workshops/advanced-angular-enterprise-architecture-incl-ivy/)
