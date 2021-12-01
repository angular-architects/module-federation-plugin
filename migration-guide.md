# Migration Guide for Angular 13

Beginning with version 13, the Angular CLI compiles bundles as EcmaScript modules. This also effects how entry points for Module Federation are generated. This guide shows how you can adjust to this.

## Force the CLI into the Newest Version of Webpack

As long as the CLI doesn't support webpack 5.64.4 or higher, we need to force it into this version. It seems like that this is necessary for CLI 13.0.x, while 13.1.x and above will ship with a fitting webpack version. In the latter case, you can skip this section. Otherwise, add this section to your ``package.json``:

```diff
+ "resolutions": {
+     "webpack": "5.64.4"
+ },
```

Then, nuke your ``node_modules`` folder and install the dependencies with yarn (!). Please note, that yarn is needed for respecting the ``resolutions`` section. Once, the CLI ships with a fitting webpack version you can git rid of this section and use other packages.

If you haven't created your project with yarn, also add the following section to your ``angular.json``:

```diff
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
+  "cli": {
+    "packageManager": "yarn"
+  },
  [...]
}
```

This makes sure that calls to commands like ``ng add`` use yarn too.

## Upgrade to the Newest Version of @angular-architects/module-federation

```
yarn add @angular-architects/module-federation@beta.0
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

If you use static federation, you need to further adjust your shell's webpack config. As EcmaScript modules can be directly imported, there is no remote name anymore. Before, this name was used as the name of a global variable that made the remote available. Hence, remove it from the values in your ``remotes`` section:

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

Also, adjust your usage of loadRemoteEntry, e. g. in your ``main.ts``:

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

### Advanced: Loading Script-based Remotes

If you also want to load script-based remotes into your shell, e. g. remotes build with Angular 12 used for a [Multi-Version/Multi-Framework setup](https://www.npmjs.com/package/@angular-architects/module-federation-tools), you can pass ``type: 'script'`` to both, ``loadRemoteModule`` and ``loadRemoteEntry``. In this case, you also need to pass a ``remoteName``.

## Example

see https://github.com/manfredsteyer/mf-angular-13
