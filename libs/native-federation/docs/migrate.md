# Migration Guide: Module Federation to Native Federation for Angular

## Motivation

Since Angular 17, the CLI ships with an esbuild-based builder that is remarkable faster than the original webpack-based solution. This new builder is used for newly generated projects and beginning with Angular 18 ng updates also migrates existing projects.

Native Federation for Angular is a thin wrapper around the esbuild builder that allows to use the proven mental model of Module Federation.

## Prerequisites

- Update your solution to the newest Angular and CLI version
- Update your solution to the newest version of `@angular-architects/module-federation` (!)
- Have a look to our [FAQs about sharing packages with Native Federation](share-faq.md)

## Migration for Angular CLI projects

1. Remove Module Federation from your poject(s):

    ```
    ng g @angular-architects/module-federation:remove --project xyz
    ```

2. Update your workspace to the new esbuild-based build system:

    ```
    ng update @angular/cli --name use-application-builder
    ```

3. Initialize Native Federation for your projects:

    ```
    ng add @angular-architects/native-federation --project xyz --type remote --port 4201
    ```

    **Remarks:** Use type `remote` or type `dynamic-host`.

4. Adjust your `federation.config.js` generated for Native Federation. You can mostly copy over the settings from your `webpack.config.js` used for Module Federation before.

5. Update your EcmaScript imports in your source code. Make sure, you import from `@angular-architects/native-federation` instead of from `@angular-architects/module-federation`. Please also note that the signature of `loadRemoteModule` has been simplified:

    ```typescript
    // Before
    import { loadRemoteModule } from '@angular-architects/module-federation';

    [...]

    export const APP_ROUTES: Routes = [
        [...]
        {
        path: 'booking',
        loadChildren: () => 
            loadRemoteModule({
            type: 'module',
            remoteEntry: 'http://localhost:4201/remoteEntry.js',
            exposedModule: './routes'
            })
            .then(m => m.MFE1_ROUTES)
        },
        [...]
    ];
    ```

    ```typescript
    // After
    import { loadRemoteModule } from '@angular-architects/native-federation';

    [...]

    export const APP_ROUTES: Routes = [
        [...]
        {
            path: 'flights',
            loadComponent: () => loadRemoteModule('mfe1', './Component')
                .then((m) => m.AppComponent),
        },
        [...]
    ];
    ```

    Please also note that loadRemoteModule now always points to a logical name that is resolved via the shell's federation manifest (`src/assets/federation.manifest.json` or `public/federation.manifest.json`):

    ```json
    {
	    "mfe1": "http://localhost:4201/remoteEntry.json"
    }
    ```

    Please also note that the remoteEntry is now a `.json` file.

6. If everything works, delete your `webpack.config.js`


## Migration for Nx projects

1. Remove Module Federation from your poject(s):

    ```
    nx g @angular-architects/module-federation:remove --project xyz
    ```

2. Initialize Native Federation for your projects:

    ```
    npm i @angular-architects/native-federation

    nx g @angular-architects/native-federation:init --project xyz --type remote --port 4201
    ```

    **Remarks:** Use type `remote` or type `dynamic-host`.

3. Adjust your federation.config.js generated for Native Federation. You can mostly copy over the settings from your `webpack.config.js` used for Module Federation before.

4. Update your EcmaScript imports in your source code. Make sure, you import from `@angular-architects/native-federation` instead of from `@angular-architects/module-federation`. Please also note that the signature of `loadRemoteModule` has been simplified:

    ```typescript
    // Before
    import { loadRemoteModule } from '@angular-architects/module-federation';

    [...]

    export const APP_ROUTES: Routes = [
        [...]
        {
        path: 'booking',
        loadChildren: () => 
            loadRemoteModule({
            type: 'module',
            remoteEntry: 'http://localhost:4201/remoteEntry.js',
            exposedModule: './routes'
            })
            .then(m => m.MFE1_ROUTES)
        },
        [...]
    ];
    ```

    ```typescript
    // After
    import { loadRemoteModule } from '@angular-architects/native-federation';

    [...]

    export const APP_ROUTES: Routes = [
        [...]
        {
            path: 'flights',
            loadComponent: () => loadRemoteModule('mfe1', './Component')
                .then((m) => m.AppComponent),
        },
        [...]
    ];
    ```

    Please also note that loadRemoteModule now always points to a logical name that is resolved via the shell's federation manifest (`src/assets/federation.manifest.json` or `public/federation.manifest.json`):

    ```json
    {
	    "mfe1": "http://localhost:4201/remoteEntry.json"
    }
    ```

    Please also note that the remoteEntry is now a `.json` file.

5. If everything works, delete your `webpack.config.js`

## Module Federation Toolkit

For Module Federation, we offered a simple toolkit helping with Multi Version/ Multi Framework scenarios. However, this toolkit was quite simple and can be implemented with just a few lines of code. To give you more flexibility, instead of providing a respective package for Native Federation, [here](https://www.angulararchitects.io/blog/micro-frontends-with-modern-angular-part-2-multi-version-and-multi-framework-solutions-with-angular-elements-and-web-components/) we describe how to implement such a functionality by yourself.

## Issues

We have tested this guide with several projects. However, each project is different. If you run into issues, feel free to let us know.
