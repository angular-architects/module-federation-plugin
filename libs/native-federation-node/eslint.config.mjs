import baseConfig from '../../eslint.base.config.mjs';
import jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  {
    // esbuild bundle produced by update-local-nf.sh, not hand-written source.
    ignores: ['src/lib/utils/fstart.mjs'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': 'error',
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
];
