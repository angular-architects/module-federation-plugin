# @angular-architects/module-federation-tools

Add-on for ``@angular-architects/module-federation`` helping to reduce boiler plate code.

The current release is focusing on combining web components with module federation for **multi framework and multi version** micro frontends: 

![Example](https://i.ibb.co/CHBQn5j/example.png)

By compiling and loading these **web components via module federation**, we can share libraries like Angular if they use the same version. Otherwise, module federation would decide at runtime to load a dedicated version of the lib for the micro frontend in question:

![Venn](https://www.angulararchitects.io/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/2020/12/venn.png.webp)

This can help to **balance the trade-off** between bundle size and isolation of micro frontends.

> **Disclaimer:** Multi-Framework and -Version Micro increase the overall complexity and call for some workarounds. This library tries to hide some of them.

## Features

- ✅ **Minimal amount** of helper functions to allow implementing multi-framework/ multi-version Micro Frontends with Module Federation
- ✅ You don't need an additional meta-framework. Instead, you just use your framework of choice, e. g. Angular
- ✅ Extension to [@angular-architects/module-federation](https://www.npmjs.com/package/@angular-architects/module-federation)

## Examples

- [Live Example](https://red-ocean-0fe4c4610.azurestaticapps.net)
- [Source Code Shell](https://github.com/manfredsteyer/multi-framework-version)
- [Source Code for Micro Frontend](https://github.com/manfredsteyer/angular-app1)
- [Source Code for Micro Frontend with Routing](https://github.com/manfredsteyer/angular3-app)
- [Source Code for Micro Frontend with Vue](https://github.com/manfredsteyer/vue-js)
- [Source Code for Micro Frontend with React](https://github.com/manfredsteyer/react-app)
- [Source Code for Micro Frontend with AngularJS](https://github.com/manfredsteyer/angularjs-app)

## Tutorial

Please find our [tutorial here](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/mf-tools/tutorial/index.md).

## Providing a Web Component with Module Federation

This helper packages assumes that Micro Frontends are exposed as Web Components.

### Exposing Micro Frontend as Web Component in Angular

To do this in Angular, install `@angular/elements`:

```bash
npm i @angular/elements
```

Then you can directly convert your AppComponent to a Web Component:

```typescript
import { createCustomElement } from '@angular/elements';
[...]

@NgModule({
  [...]
  declarations: [
    AppComponent
  ],
  bootstrap: [] // No bootstrap components!
})
export class AppModule {
  constructor(private injector: Injector) {
  }

  ngDoBootstrap() {
    const ce = createCustomElement(AppComponent, {injector: this.injector});
    customElements.define('angular1-element', ce);
  }

}
```

### Exposing Web Component with other Frameworks like React

If you framework doesn't directly support exposing your application as a web component, you can easily write a simple Wrapper around it. Basically, a web component -- to be more precise: a custom element -- is just an EcmaScript class extending ``HtmlElement`` and registered via ``customElements.register``. Please find an [example for React here](https://github.com/manfredsteyer/react-app/blob/main/app.js).

### Exposing Web Component-based Micro Frontend via Module Federation

Add ``@angular-architects/module-federation`` to your micro frontend:

```
ng add @angular-architects/module-federation
```

Make your ``webpack.config.js`` expose the whole ``bootstrap.ts`` that bootstraps your ``AppModule``.

```typescript
// webpack.config.js
name: "angular3",
library: { type: "var", name: "angular3" },
filename: "remoteEntry.js",
exposes: {
    './web-components': './src/bootstrap.ts',
},
```

If the file that bootstraps your applications is called differently, adjust these settings accordingly.

## Helper for Angular 

For enabling Angular for a multi version/ multi framework scenario, we need some helper functions. The easiest way to use them, is to bootstrap your Angular app with our bootstrap helper:


```typescript
// main.ts
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { bootstrap } from '@angular-architects/module-federation-tools';

bootstrap(AppModule, {
  production: environment.production,
  appType: 'shell', 
  // appType: 'microfrontend' 
});
```

> Use this bootstrap helper for **both**, your shell and your micro frontends!

Please make sure to set the ``appType`` to ``shell`` for your shell application and to ``microfrontend`` for your Micro Frontends.


## Routing to Web Components

The ``WebComponentWrapper`` helps you to route to web components:

```typescript
export const APP_ROUTES: Routes = [
    [...]
    {
        path: 'angular1',
        component: WebComponentWrapper,
        data: {
          remoteEntry: 'https://nice-grass-018f7d910.azurestaticapps.net/remoteEntry.js',
          remoteName: 'angular1',
          exposedModule: './web-components',
          elementName: 'angular1-element'
        } as WebComponentWrapperOptions
    },
    [...]
}
```

### Important: Angular 13+

Beginning with Angular 13, the CLI is emitting EcmaScript modules. Hence, we need to adjust the usage of the WebComponentWrapper when loading a remote that has been created with the CLI 13 or higher. For this, set ``type`` to ``remote`` and skip the ``remoteName`` property (for Modules, we don't need a remoteName):

```typescript
export const APP_ROUTES: Routes = [
    [...]
    {
        path: 'angular1',
        component: WebComponentWrapper,
        data: {
          type: 'module',
          remoteEntry: 'https://your-path/remoteEntry.js',
          exposedModule: './web-components',
          elementName: 'angular1-element'
        } as WebComponentWrapperOptions
    },
    [...]
}
```

## Sub-Routes

If a web component has it's own router, you can use our UrlMatchers ``startsWith`` and ``endsWith`` to define, which part of the URL is intended for the shell and for the micro frontend:

```typescript
// Shell
export const APP_ROUTES: Routes = [
    [...]
    {
        matcher: startsWith('angular3'),
        component: WebComponentWrapper,
        data: {
          remoteEntry: 'https://gray-river-0b8c23a10.azurestaticapps.net/remoteEntry.js',
          remoteName: 'angular3',
          exposedModule: './web-components',
          elementName: 'angular3-element'
        } as WebComponentWrapperOptions
    },
    [...]
}
```

```typescript
// Micro Frontend
RouterModule.forRoot([
      { path: 'angular3/a', component: AComponent },
      { path: 'angular3/b', component: BComponent },

      // To prevent issues when routing to other micro frontends
      // a catch-all route should be defined
      { path: '**', component: EmptyComponent },

]);
```

## Directly Loading a Web Component via Module Federation

The ``WebComponentWrapper`` can also be used as a traditional component:

```html
<mft-wc-wrapper [options]="item"></mft-wc-wrapper>
```

```typescript
item: WebComponentWrapperOptions = {
    remoteEntry: 'https://witty-wave-0a695f710.azurestaticapps.net/remoteEntry.js',
    remoteName: 'react',
    exposedModule: './web-components',
    elementName: 'react-element'
}, 
```

The optional properties ``props`` and ``events`` allow to defined properties and events for the web component:

```typescript
props = {
    "message": "Hello from Shell"
}

events = {
    "clicked": (event) => {
        console.debug('clicked!', event);
    }
}
```

```html
<mft-wc-wrapper [options]="item" [props]="props" [events]="events"></mft-wc-wrapper>
```

## Some Additional Details 

> In a multi version micro frontend strategy, it is important to load the zone.js bundle to the window object only once. Also, one need to make sure that only one instance of the ngZone is used by all the micro frontends.

If you share `@angular/core` and therefore also have one technical reference to the BrowserPlatform, that is used by more than one micro frondend, Angular's default setup is, to support only one platform instance per shared version. Be aware that you **need** to create multi platform instances in case of different versions, but also in case the version is the same, but `@angular/core` is not shared, but packed into the micro frontend's bundles directly (like in Angular's default way w/o module federation).

Naturally, such technical details are hard to get into. Therefore the `bootstrap()` function of this package helps to implement your multi version strategy w/o the need of implementing those low-level aspects on your own.

Some optional flags are offered to provide options for custom behavior of the `bootstrap()` function:

- `ngZoneSharing: false`: Deactivate ngZone sharing in the window object (not recommended):
  ```typescript
  bootstrap(AppModule, {
    production: environment.production,
    ngZoneSharing: false // defaults to true
  });
  ```
- `platformSharing: false`: Deactivate Platform sharing in the window object (not recommended):
  ```typescript
  bootstrap(AppModule, {
    production: environment.production,
    platformSharing: false // defaults to true
  });
  ```
  - Possible, if dependencies are not shared or each bootstrapped remote app uses a different version.
- `activeLegacyMode: false`: Deactivates the legacy mode that provides backwards compatibility for Platform sharing:
  ```typescript
  bootstrap(AppModule, {
    production: environment.production,
    activeLegacyMode: false // defaults to true
  });
  ```
  - If all your micro frontends use `@angular-architects/module-federation-tools` in version `^12.6.0`, `^13.1.0` or any newer major version you can switch off the legacy mode manually.
  - Those versions introduced new features on how to share the Platform in the window object.
  - This allows to use the `bootstrap()` function even in such cases, where the same version is packed into different micro frontend bundles.



## More about the underlying ideas

Please find more information on the underlying ideas in this [blog article](https://www.angulararchitects.io/aktuelles/multi-framework-and-version-micro-frontends-with-module-federation-the-good-the-bad-the-ugly).

