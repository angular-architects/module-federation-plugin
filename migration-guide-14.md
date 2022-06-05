# Migration Guide for Angular 14

## Streamlined Configuration

With version 14, we introduced a new and more streamlined way of configuring Module Federation. **The old way still works**, but you might want to move over to the new more concise way using the new ``withModuleFederationPlugin`` helper function.

The schematics and ng add use this new way automatically if you set the ``--type`` switch to ``host``, ``dynamic-host``, or ``remote``. 

This is an example for configuring a remote with the new streamlined form:

```javascript
const { shareAll, withModuleFederationPlugin } = require('@angular-architects/module-federation/webpack');

// Version 14
module.exports = withModuleFederationPlugin({

  name: 'mfe1',

  exposes: {
    './Module': './projects/mfe1/src/app/flights/flights.module.ts',
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: 'auto' }),
  },

});
```

In version 13, the same looked like this:

```javascript
// Version 13
const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const mf = require("@angular-architects/module-federation/webpack");
const path = require("path");

const share = mf.share;

const sharedMappings = new mf.SharedMappings();
sharedMappings.register(
  path.join(__dirname, '../../tsconfig.json'),
  ['auth-lib']  
);

module.exports = {
  output: {
    uniqueName: "mfe1",
    publicPath: "auto"
  },
  optimization: {
    runtimeChunk: false
  },  
  resolve: {
    alias: {
      ...sharedMappings.getAliases(),
    }
  },
  experiments: {
    outputModule: true
  },  
  plugins: [
    new ModuleFederationPlugin({
        library: { type: "module" },

        // For remotes (please adjust)
        name: "mfe1",
        filename: "remoteEntry.js",  // 2-3K w/ Meta Data
        exposes: {
            './Module': './projects/mfe1/src/app/flights/flights.module.ts',
        },        
        shared: share({
          "@angular/core": { singleton: true, strictVersion: true, requiredVersion: 'auto' },
          "@angular/common": { singleton: true, strictVersion: true, requiredVersion: 'auto' },
          "@angular/router": { singleton: true, strictVersion: true, requiredVersion: 'auto' },
          "@angular/common/http": { singleton: true, strictVersion: true, requiredVersion: 'auto' }, 
  
          // Uncomment for sharing lib of an Angular CLI or Nx workspace
          ...sharedMappings.getDescriptors()
        })
        
    }),
    // Uncomment for sharing lib of an Angular CLI or Nx workspace
    sharedMappings.getPlugin(),
  ],
};
```

While the new version is quite shorter, it still contains the settings, one usually adjusts -- the settings passed to the ModuleFederationPlugin. The new helper ``withModuleFederationPlugin`` supports a **super set** of these settings and uses **smart defaults**.

These defaults are:

- ``library: { type: "module" }``: This is what you need for Angular >= 13 as CLI 13 switched over to emitting "real" EcmaScript modules instead of just ordinary JavaScript bundles. 
- ``filename: 'remoteEntry.js'``: This makes Module Federation emit a file ``remoteEntry.js`` with the remote entry point.
- ``share: shareAll(...)``: This shares all packages found in the dependencies section of your ``package.json`` by default. 
- ``sharedMappings``: If you skip the ``sharedMappings`` array, all local libs (aka mono repo-internal libs or mapped paths) are shared. Otherwise, only the mentioned libs are shared

## Remarks on shareAll

As mentioned above, withModuleFederationPlugin uses shareAll by default. This allows for a quick first setup that works. However, it might lead to too much shared bundles. Please also note, that shared dependencies cannot be tree shaken. You can optimize this by switching over from ``shareAll`` to the ``share`` helper shown above. 