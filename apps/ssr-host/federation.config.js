const {
  withNativeFederation,
  shareAll,
} = require('dist/libs/native-federation/src/config.js');

module.exports = withNativeFederation({
  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
  },

  skip: [
    '@softarc/native-federation',
    '@angular-architects/build_angular',
    '@angular-architects/module-federation',
    '@angular-architects/module-federation-runtime',
    '@angular-architects/module-federation-tools',
    '@angular-architects/native-federation',
    '@softarc/native-federation-esbuild',
    '@softarc/native-federation-runtime',
    '@softarc/native-federation/build',
    '@module-federation/vite',
    // Add further packages you don't need at runtime
  ],

  // Please read our FAQ about sharing libs:
  // https://shorturl.at/jmzH0
});
