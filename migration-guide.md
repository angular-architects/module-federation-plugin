# Migration Guide for Angular 13

Beginning with version 13, the Angular CLI compiles emits EcmaScript modules. This also effects how entry points for Module Federation are generated. This guide shows how you can adjust to this.

## Big Thanks

Big thanks to all the people, that helped with this migration:

- [Tobias Koppers](https://twitter.com/wSokra), Founder of Webpack
- [Colum Ferry](https://twitter.com/ferrycolum), Senior Software Engineer 
at NRWL
- [Thomas Sandeep](https://github.com/SandeepThomas)
- [Michael Zikes](https://twitter.com/MikeZks)

## Upgrade to the Newest Version of @angular-architects/module-federation

```
yarn add @angular-architects/module-federation@14.0.0-rc.1
```

## Upgrade to Angular and Angular CLI 13.1 (!) or higher

As we need a newer webpack version, don't go with Angular 13.0 but with 13.1 or higher.

## Update your Compilation Target 

In your ``tsconfig.json`` or ``tsconfig.base.json``, make sure, your compilation ``target`` is ``es2020`` or higher:


```json
{
  "compileOnSave": false,
  "compilerOptions": {
    [...]
    "target": "es2020",
    [...]
  },
  [...]
}
```

## Adjust your webpack Configs

Add the following setting to all your webpack configs:

```diff
[...]
module.exports = {
  [...]
+  experiments: {
+    outputModule: true
+  },
  plugins: [
    new ModuleFederationPlugin({
+        library: { type: "module" },

        [...]
    })
  ]
};
```

## Static Federation

If you use static federation, you need to further adjust your shell's webpack config. As EcmaScript modules can be directly imported, there is no ``remoteName`` anymore. Before, this name was used as the name of a global variable that made the remote available. Hence, remove it from the values in your ``remotes`` section:

```diff
[...]
module.exports = {
  [...]
  plugins: [
    new ModuleFederationPlugin({
        library: { type: "module" },

        // For hosts (please adjust)
        remotes: {
          // Load as module
-          "mfe1": "mfe1@http://localhost:3000/remoteEntry.js", 
+          "mfe1": "http://localhost:3000/remoteEntry.js", 

        },

        [...]
    })

  ]
};
```

## Dynamic Federation

Adjust your usage of ``loadRemoteModule``, e. g. in your routing config:

```diff
{
    path: 'flights',
    loadChildren: () =>
        loadRemoteModule({
+            type: 'module',
            remoteEntry: 'http://localhost:3000/remoteEntry.js',
-            remoteName: 'mfe1',
            exposedModule: './Module'
        })
        .then(m => m.FlightsModule)
},
```

Also, adjust your usage of ``loadRemoteEntry``, e. g. in your ``main.ts``:

```diff
- loadRemoteEntry('http://localhost:3000/remoteEntry.js', 'mfe1')
+ loadRemoteEntry({ type: 'module', remoteEntry: 'http://localhost:3000/remoteEntry.js'})
	.then(_ => import('./bootstrap').catch(err => console.error(err)))

```

### Adjusting your angular.json

To prevent issues with live reloads, you need to add a ``publicHost`` property to your remote's configuration in your ``angular.json``. Hence, adjust the section ``project/remote-project-name/architect/serve/options`` as follows:

```diff
[...]
"options": {
+   "publicHost": "http://localhost:3000",
    "port": 3000,
    "extraWebpackConfig": "projects/mfe1/webpack.config.js"
}
[...]
```

### Deployment: Enable CORS

As remotes are now loaded as EcmaScript modules, the same origin policy is in place. Hence, if your micro frontends and the shell are deployed to different origins, you need to enable CORS. The same holds true if you run your application after building it with a command line web server like ``serve`` (``serve``, e. g., has a ``--cors`` options). 

### Advanced: Dynamic Federation with Script-based Remotes

If you also want to load (existing) script-based remotes into your shell, e. g. remotes built with Angular 12 used for a [Multi-Version/Multi-Framework setup](https://www.npmjs.com/package/@angular-architects/module-federation-tools), you can pass ``type: 'script'`` to both, ``loadRemoteModule`` and ``loadRemoteEntry``. In this case, you also need to pass a ``remoteName``.

### Advanced: Static Federation with Script-based Remotes

If you want to load (existing) script-based remote into your shell, e. g. such built with Angular 12, you can use the following syntax in the shell's ``webpack.config.js``.

In the following example, ``mfe1`` is loaded as a module while ``mfe2`` is loaded as a script:

```javascript
remotes: {
  // Load as module:
  mfe1": "http://localhost:3000/remoteEntry.js",
  
  // Load as script:
  mfe2": "script mfe2@http://localhost:3000/remoteEntry.js",
}
```

### Advanced: Opting-out of Using EcmaScript Modules

While moving forward with Modules and aligning with the CLI is a good idea, you might to temporarily opt-out of using them. This gives you some additional time for the migration as it brings back the behavior of Angular 12. For this, adjust your webpack configs as follows:

```diff
module.exports = {
  output: {
    uniqueName: "dashboard",
    publicPath: "auto",
+    scriptType: 'text/javascript'
  }, 
  [...]
}
```

Also, use remoteName insteadof {type: 'module'} don't use the settings introduced above for Angular 13.1+:


```diff
[...]
module.exports = {
  [...]
-  experiments: {
-    outputModule: true
-  },
  plugins: [
    new ModuleFederationPlugin({
-        library: { type: "module" },

        [...]
    })
  ]
};
```

## SSR

We have a sound solution including Schematics for SSR in Angular 12. However, because of a bug in Angular Universal 13, SSR is currently not supported for Angular 13. However, we are monitoring this situation and providing a solution as soon as these issues are fixed.

## Example

see https://github.com/manfredsteyer/mf-angular-13
