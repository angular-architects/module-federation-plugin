/* eslint-disable */
export default {
  displayName: 'mf',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.m?[tj]s$': [
      'ts-jest',
      { tsconfig: '<rootDir>/tsconfig.spec.json', useESM: false },
    ],
  },
  // @angular-devkit/schematics pulls in magic-string >=1, which is ESM-only, so
  // it has to be transpiled to CJS rather than skipped like the rest of node_modules.
  transformIgnorePatterns: ['node_modules/(?!(magic-string)/)'],
  moduleFileExtensions: ['ts', 'js', 'mjs', 'html'],
  coverageDirectory: '../../coverage/libs/mf',
};
