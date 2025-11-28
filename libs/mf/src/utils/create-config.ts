import { strings } from '@angular-devkit/core';

export function createConfig(
  projectName: string,
  remotes: string,
  tsConfigName: string,
  root: string,
): string {
  return `const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const mf = require("@angular-architects/module-federation/webpack");
const path = require("path");
const share = mf.share;

const sharedMappings = new mf.SharedMappings();
sharedMappings.register(
  path.join(__dirname, '${tsConfigName}'),
  [/* mapped paths to share */]);

module.exports = {
  output: {
    uniqueName: "${strings.camelize(projectName)}",
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
        // name: "${strings.camelize(projectName)}",
        // filename: "remoteEntry.js",
        // exposes: {
        //     './Component': './${root}/src/app/app.component.ts',
        // },

        // For hosts (please adjust)
        // remotes: {
${remotes}
        // },

        shared: share({
          "@angular/core": { singleton: true, strictVersion: true, requiredVersion: 'auto' },
          "@angular/common": { singleton: true, strictVersion: true, requiredVersion: 'auto' },
          "@angular/common/http": { singleton: true, strictVersion: true, requiredVersion: 'auto' },
          "@angular/router": { singleton: true, strictVersion: true, requiredVersion: 'auto' },

          ...sharedMappings.getDescriptors()
        })

    }),
    sharedMappings.getPlugin()
  ],
};
`;
}
