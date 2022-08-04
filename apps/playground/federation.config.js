const { withNativeFederation, shareAll } = require("@angular-architects/native-federation");

module.exports = withNativeFederation({

  exposes: {
    './cmp': 'apps/playground/src/app/app.component.ts'
  },

  shared: {
    ...shareAll({ singleton: true, strictVersion: true, requiredVersion: "auto" }),
  }

});