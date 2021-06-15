# @angular-architects/module-federation-tools

Add-on for ``@angular-architects/module-federation`` helping to reduce boiler plate code.

The current release is focusing on combining web components with module federation for **multi framework and multi version** micro frontends: 

![Example](https://i.ibb.co/CHBQn5j/example.png)

By compiling and loading these **web components via module federation**, we can share libraries like Angular if they use the same version. Otherwise, module federation would decide at runtime to load a dedicated version of the lib for the micro frontend in question:

![Venn](https://www.angulararchitects.io/wp-content/webp-express/webp-images/doc-root/wp-content/uploads/2020/12/venn.png.webp)

This can help to **balance the trade-off** between bundle size and isolation of micro frontends.

> **Disclaimer:** Multi-Framework and -Version Micro increase the overall complexity and call for some workarounds. This library tries to hide some of them.

## Examples

- [Source Code (Shell, see branch multi-framework-version)](https://red-ocean-0fe4c4610.azurestaticapps.net)
- [Source Code for Micro Frontend](https://github.com/manfredsteyer/angular-app1)
- [Source Code for Micro Frontend with Routing](https://github.com/manfredsteyer/angular3-app)


## Providing a Web Component with Module Federation

Expose your Angular components via Angular Elements:

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

## Bootstrapping

Our ``bootstrap`` helper function bootstraps your shell and your micro frontend and takes care of some details needed in a multi-framework/ multi-version scenario (like sharing the ``platform`` used).

```typescript
// main.ts
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { bootstrap } from '@angular-architects/module-federation-tools';

bootstrap(AppModule, {
  production: environment.production
});
```

> Use this bootstrap helper for **both**, your shell and your micro frontends!

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
export const APP_ROUTES: Routes = [
    [...]
    { matcher: endsWith('a'), component: AComponent},
    { matcher: endsWith('b'), component: BComponent},
    [...]
}
```

In order to prevent issues with the "inner" router, use our helper function ``connectRouter``.

```typescript
// AppComponent in Micro Frontend
@Component({ ... })
export class AppComponent {

  constructor(private router: Router) { }

  ngOnInit(): void {
    connectRouter(this.router);
  }

}
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

## Sharing Zone.js

In order to share zone.js, call our ``shareNgZone`` helper when starting the shell. 

```typescript
import { Component, NgZone } from '@angular/core';
import { shareNgZone } from '@angular-architects/module-federation-tools';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
})
export class AppComponent {
  title = 'shell';

  constructor(private ngZone: NgZone) {
    shareNgZone(ngZone);
  }

}
```

The micro frontends will pick it up, if they are bootstrapped with the ``bootstrap`` helper (see above).

## More about the underlying ideas

Please find more information on the underlying ideas in this [blog article](https://www.angulararchitects.io/aktuelles/multi-framework-and-version-micro-frontends-with-module-federation-the-good-the-bad-the-ugly).

