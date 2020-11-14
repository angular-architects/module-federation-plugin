export function createConfig(projectName: string, root: string, port: number): string {

    return `const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");

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
          "@angular/router": { singleton: true, strictVersion: true }
        }
        
    })
  ],
};
`;

}