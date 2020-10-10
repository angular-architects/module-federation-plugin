module.exports = {
  displayName: 'mf-e2e',
  preset: '../../jest.preset.js',
  verbose: true,
  silent: false,
  globals: {
    'ts-jest': {
      tsConfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  transform: {
    '^.+\\.[tj]s$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/e2emf-e2e',
};
