const { withNativeFederation, shareAll } = require("@angular-architects/native-federation/config");

module.exports = withNativeFederation({

  name: 'mfe1',

  exposes: {
    './cmp': 'apps/mfe1/src/app/demo/demo.component.ts'
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: "auto" }),
  },
  
  sharedMappings: [
    '@angular-architects/playground-lib'
  ],

});