import { join } from 'path';

// findRootTsConfigJson() walks up from cwd() to the real workspace tsconfig.
// Point it at a fixture instead so the mappings under test are fixed.
jest.mock('./share-utils', () => ({
  ...jest.requireActual('./share-utils'),
  findRootTsConfigJson: jest.fn(),
}));

import { findRootTsConfigJson } from './share-utils';
import { withModuleFederationPlugin } from './with-mf-plugin';

const FIXTURE_TSCONFIG = join(__dirname, '__fixtures__/tsconfig.paths.json');

beforeEach(() => {
  (findRootTsConfigJson as jest.Mock).mockReturnValue(FIXTURE_TSCONFIG);
});

// `shared: {}` keeps shareAll() — which reads the real root package.json — out
// of these tests. The sharedMappings descriptors are merged into it either way.
function build(config: Record<string, unknown>) {
  // withModuleFederationPlugin mutates the config it is handed, merging the
  // mapping descriptors into `shared` before passing it to the webpack plugin.
  const mfConfig: Record<string, unknown> = { shared: {}, ...config };
  const result = withModuleFederationPlugin(mfConfig);

  return {
    aliases: Object.keys(result.resolve.alias),
    shared: Object.keys(mfConfig['shared']),
  };
}

describe('withModuleFederationPlugin sharedMappings', () => {
  it('maps a library that is not skip-listed', () => {
    const { aliases, shared } = build({ sharedMappings: ['my-lib'] });

    expect(aliases).toEqual(['my-lib']);
    expect(shared).toEqual(['my-lib']);
  });

  it('drops entries on DEFAULT_SKIP_LIST', () => {
    const { aliases, shared } = build({
      sharedMappings: [
        '@angular-architects/module-federation',
        'tslib',
        'my-lib',
      ],
    });

    expect(aliases).toEqual(['my-lib']);
    expect(shared).toEqual(['my-lib']);
  });

  it('drops entries on DEFAULT_SECONDARIES_SKIP_LIST', () => {
    const { aliases, shared } = build({
      sharedMappings: ['@angular/router/upgrade', 'my-lib'],
    });

    expect(aliases).toEqual(['my-lib']);
    expect(shared).toEqual(['my-lib']);
  });

  it('drops entries named in the caller-supplied skip option', () => {
    const { aliases, shared } = build({
      sharedMappings: ['opt-out-lib', 'my-lib'],
      skip: ['opt-out-lib'],
    });

    expect(aliases).toEqual(['my-lib']);
    expect(shared).toEqual(['my-lib']);
  });

  it('maps nothing when every entry is skipped', () => {
    // An empty array must not be mistaken for "no sharedMappings given", which
    // is what turns on the map-every-tsconfig-path behaviour below.
    const { aliases, shared } = build({ sharedMappings: ['tslib'] });

    expect(aliases).toEqual([]);
    expect(shared).toEqual([]);
  });

  it('maps every tsconfig path when sharedMappings is omitted', () => {
    // Pre-existing asymmetry: the skip list is only consulted for an explicit
    // sharedMappings array, so this path still maps skip-listed keys.
    const { aliases } = build({});

    expect(aliases).toEqual([
      '@angular-architects/module-federation',
      'tslib',
      '@angular/router/upgrade',
      'my-lib',
      'opt-out-lib',
    ]);
  });
});
