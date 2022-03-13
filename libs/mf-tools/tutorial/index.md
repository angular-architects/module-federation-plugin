# Tutorial: Module Federation Tools

This tutorial is an **extension** for the ``@angular-architects/module-federation`` tutorial [here](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/mf/tutorial/tutorial.md) and shows, how to use the add-on lib ``@angular-architects/module-federation-tools`` to load web components exposed via module federation.

## Getting Started

### Option A: Start with the Upstream Tutorial

Please find the upstream tutorial this tutorial extends [here](https://github.com/angular-architects/module-federation-plugin/blob/main/libs/mf/tutorial/tutorial.md).

### Option B: Checkout the Starter Kit

If you don't want to do the upstream tutorial first, you can use [this example](https://github.com/manfredsteyer/module-federation-plugin-example) (see main branch) as the starting point.


## Part 1: Routing to Web Components

1. Install ``@angular-architects/module-federation-tools``:

    ```
    npm i @angular-architects/module-federation-tools
    ```

2. Restart your VS Code (or your TS Server within VS Code at least)

3. Open your shell's ``app.routes.ts`` and add the following routes:

    ```typescript
    export const APP_ROUTES: Routes = [

        [...]

        {
        path: 'react',
        component: WebComponentWrapper,
        data: {
            type: 'script',
            remoteEntry: 'https://witty-wave-0a695f710.azurestaticapps.net/remoteEntry.js',
            remoteName: 'react',
            exposedModule: './web-components',
            elementName: 'react-element'
        } as WebComponentWrapperOptions
        },   
        
        {
        path: 'angular1',
        component: WebComponentWrapper,
        data: {
            type: 'script',
            remoteEntry: 'https://nice-grass-018f7d910.azurestaticapps.net/remoteEntry.js',
            remoteName: 'angular1',
            exposedModule: './web-components',
            elementName: 'angular1-element'
        } as WebComponentWrapperOptions
        },    

        {
        path: 'angular2',
        component: WebComponentWrapper,
        data: {
            type: 'script',
            remoteEntry: 'https://gray-pond-030798810.azurestaticapps.net//remoteEntry.js',
            remoteName: 'angular2',
            exposedModule: './web-components',
            elementName: 'angular2-element'
        } as WebComponentWrapperOptions
        },   
        
        {
        matcher: startsWith('angular3'),
        component: WebComponentWrapper,
        data: {
            type: 'script',
            remoteEntry: 'https://gray-river-0b8c23a10.azurestaticapps.net/remoteEntry.js',
            remoteName: 'angular3',
            exposedModule: './web-components',
            elementName: 'angular3-element'
        } as WebComponentWrapperOptions
        }, 

        {
        path: 'vue',
        component: WebComponentWrapper,
        data: {
            type: 'script',
            remoteEntry: 'https://mango-field-0d0778c10.azurestaticapps.net/remoteEntry.js',
            remoteName: 'vue',
            exposedModule: './web-components',
            elementName: 'vue-element'
        } as WebComponentWrapperOptions
        },  
        
        {
        path: 'angularjs',
        component: WebComponentWrapper,
        data: {
            type: 'script',
            remoteEntry: 'https://calm-mud-0a3ee4a10.azurestaticapps.net/remoteEntry.js',
            remoteName: 'angularjs',
            exposedModule: './web-components',
            elementName: 'angularjs-element'
        } as WebComponentWrapperOptions
        },     

        {
        matcher: startsWith('angular3'),
        component: WebComponentWrapper,
        data: {
            type: 'script',
            remoteEntry: 'https://gray-river-0b8c23a10.azurestaticapps.net/remoteEntry.js',
            remoteName: 'angular3',
            exposedModule: './web-components',
            elementName: 'angular3-element'
        } as WebComponentWrapperOptions
        }, 

        // THIS needs to be the last route!!!
        {
        path: '**',
        component: NotFoundComponent
        }

    ];
    ```

    **Hint:** Add the missing imports using your IDE's auto import feature.

    **Remarks:** Please note that we are using ``type: 'script'`` here. This is needed for classic webpack setups as normally used in the Vue and React world as well as for Angular before version 13. Beginning with version 13, the CLI emits EcmaScript module instead of "plain old" JavaScript files. Hence, when loading a remote compiled with Angular 13 or higher, you need to set `type` to ``module``. In our case, however, the remotes we find at the shown URLs in the cloud are Angular 12-based, hence we need ``type: 'script'``.  


4. Open your shell's ``app.component.html`` and add the following links:

    ```html
    <li><a routerLink="/react">React</a></li>
    <li><a routerLink="/angular1">Angular 1</a></li>
    <li><a routerLink="/angular2">Angular 2</a></li>
    <li><a routerLink="/angular3/a">Angular 3</a></li>
    <li><a routerLink="/vue">Vue</a></li>
    <li><a routerLink="/angularjs">AngularJS</a></li>
    ```

5. Open your shell's ``bootstrap.ts`` and use the ``bootstrap`` helper function found in ``@angular-architects/module-federation-tools`` for bootstrapping:

    ```typescript
    import { AppModule } from './app/app.module';
    import { environment } from './environments/environment';
    import { bootstrap } from '@angular-architects/module-federation-tools';
    
    bootstrap(AppModule, {
        production: environment.production,
        appType: 'shell'
    })
    ```

6. Start your shell and your mfe1 (e. g. by calling ``npm run run:all``) and try it out.

## Part 2: Inspect the Web-Component-based Micro Frontends

In this part of the lab, we will investigate the loaded micro frontend that has been called ["MF Angular #3"](https://github.com/manfredsteyer/angular3-app) before. We want to draw your attention to the following details:

1. The application is bootstrapped with the [bootstrap function](https://github.com/manfredsteyer/angular3-app/blob/main/src/bootstrap.ts) already used above. Please note that here, ``appType`` is set to ``microfrontend``.

2. The ``AppModule`` is wrapping some components as web components using Angular Elements in it's [ngDoBootstrap](https://github.com/manfredsteyer/angular3-app/blob/main/src/app/app.module.ts) method.

3. The [webpack config](https://github.com/manfredsteyer/angular3-app/blob/main/webpack.config.js) exposes the whole ``bootstrap.ts`` file. Hence, everyone importing it can use the provided web components. 

4. The [webpack config](https://github.com/manfredsteyer/angular3-app/blob/main/webpack.config.js) shares libraries like ``@angular/core``. 


## More Details on Module Federation **

If you would like to know more about Module Federation with Angular take a look at this [article series about Module Federation](https://www.angulararchitects.io/aktuelles/the-microfrontend-revolution-part-2-module-federation-with-angular/).
