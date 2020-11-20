export function createConfig(projectName: string, tsConfigName: string, root: string, port: number): string {

    return `const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const mf = require("@angular-architects/module-federation/webpack");
const path = require("path");

const sharedMappings = new mf.SharedMappings();
sharedMappings.register(path.join(__dirname, '${tsConfigName}'));

module.exports = {
  output: {
    uniqueName: "${projectName}"
  },
  optimization: {
    // Only needed to bypass a temporary bug
    runtimeChunk: false
  },
  plugins: [
    new ModuleFederationPlugin({
      
        // For remotes (please adjust)
        // name: "${projectName}",
        // filename: "remoteEntry.js",
        // exposes: {
        //     './Component': './${root}/src/app/app.component.ts',
        // },        
        
        // For hosts (please adjust)
        // remotes: {
        //     'mfe1': "mfe1@http://localhost:3000/remoteEntry.js" 
        // },

        shared: {
          "@angular/core": { singleton: true, strictVersion: true }, 
          "@angular/common": { singleton: true, strictVersion: true }, 
          "@angular/router": { singleton: true, strictVersion: true },

          // Uncomment for sharing lib of an Angular CLI or Nx workspace
          // ...sharedMappings.getDescriptors()
        }
        
    }),
    // Uncomment for sharing lib of an Angular CLI or Nx workspace
    // sharedMappings.getPlugin(),
  ],
};
`;

}