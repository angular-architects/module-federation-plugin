import * as path from 'path';
import type { Configuration } from '@rspack/core';
import { Shared } from '@rspack/core/dist/sharing/SharePlugin';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import { applySkipList, normalizeSkipList, SkipList } from '../utils/skip-list';
import {
  DEFAULT_SECONDARIES_SKIP_LIST,
  DEFAULT_SKIP_LIST,
  findRootTsConfigJson,
  SharedMappings,
} from '../webpack';
import type { SharedLib } from './shared-mappings-loader';

export type FederationOptions = {
  name?: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Shared;
};

export type FederationConfig = {
  options: FederationOptions;

  // Monorepo libs to share, by their `paths` key in the root tsconfig. When
  // omitted, every non-wildcard `paths` entry that survives the skip list is
  // shared.
  sharedMappings?: string[];

  skip?: SkipList;
};

export function withFederation(config: FederationConfig) {
  //
  // `@nx/angular-rspack`'s `createConfig` resolves to a `Configuration[]`
  // (browser config, plus a server config when SSR is enabled). We apply
  // Module Federation to the browser config and leave any server config
  // untouched, so this composes directly with `createConfig(...).then(...)`.
  //
  return (configs: Configuration[]): Configuration[] =>
    configs.map((rspackConfig) =>
      isServerConfig(rspackConfig)
        ? rspackConfig
        : applyFederation(rspackConfig, config),
    );
}

export function applyFederation(
  rspackConfig: Configuration,
  federationConfig: FederationConfig,
): Configuration {
  const { skip, sharedMappings, ...mfConfig } = federationConfig;
  const normalizedSkip = normalizeSkipList([
    ...DEFAULT_SKIP_LIST,
    ...DEFAULT_SECONDARIES_SKIP_LIST,
    ...(skip ?? []),
  ]);

  const mappings = new SharedMappings();
  mappings.register(
    findRootTsConfigJson(),
    sharedMappings?.filter((key) => !normalizedSkip.some((f) => f(key))),
  );

  const shared = (mfConfig.options.shared ?? {}) as Shared;
  const sharedWithLibs: Shared = {
    ...mappings.getDescriptors(),
    ...shared,
  };
  const filteredShared = applySkipList(normalizedSkip, sharedWithLibs);

  //
  // Angular output produced by `@nx/angular-rspack` is an ES module (it relies
  // on `import.meta`, and its entry scripts are emitted as `type="module"`).
  // The federation container therefore has to be an ES module as well —
  // otherwise the runtime loads `remoteEntry.js` as a classic script and
  // `import.meta` throws (`Cannot use 'import.meta' outside a module`).
  //
  rspackConfig.experiments = {
    ...rspackConfig.experiments,
    outputModule: true,
  };
  rspackConfig.output = {
    ...rspackConfig.output,
    uniqueName: mfConfig.options.name || undefined,
    publicPath: 'auto',
    module: true,
    library: { type: 'module' },
    chunkFormat: 'module',
    chunkLoading: 'import',
    workerChunkLoading: 'import',
    wasmLoading: 'fetch',
  };
  rspackConfig.optimization = {
    ...rspackConfig.optimization,
    runtimeChunk: 'single',
  };

  rspackConfig.resolve = {
    ...rspackConfig.resolve,
    alias: {
      ...rspackConfig.resolve?.alias,
      ...mappings.getAliases(),
    },
  };

  applySharedMappingsLoader(rspackConfig, mappings);

  rspackConfig.plugins ??= [];
  rspackConfig.plugins.push(
    new ModuleFederationPlugin({
      name: mfConfig.options.name || 'host',
      filename: 'remoteEntry.js',
      exposes: mfConfig.options.exposes,
      remotes: mfConfig.options.remotes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shared: filteredShared as any,
      library: { type: 'module' },
      remoteType: 'module',
    }),
  );

  //
  // Dev server tweaks for `rspack serve`:
  // - HMR is disabled: hot updates don't work across module-format federated
  //   boundaries yet and send the runtime into an aborted-chunk reload loop.
  //   (The original rsbuild integration disabled `hmr` for the same reason.)
  // - CORS is enabled: loading module remotes across origins uses `import()`,
  //   which is subject to CORS, so a host can pull a remote's entry.
  //
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (rspackConfig as any).devServer = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(rspackConfig as any).devServer,
    hot: false,
    liveReload: false,
    headers: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...((rspackConfig as any).devServer?.headers ?? {}),
      'Access-Control-Allow-Origin': '*',
    },
  };

  return rspackConfig;
}

//
// See shared-mappings-loader.ts for why the mappings are applied by a loader
// here rather than by `SharedMappings.getPlugin()` — which is a *webpack*
// `NormalModuleReplacementPlugin` and cannot drive rspack's consume-shared
// modules even once it is swapped for rspack's own.
//
function applySharedMappingsLoader(
  rspackConfig: Configuration,
  mappings: SharedMappings,
): void {
  const libs: SharedLib[] = Object.entries(mappings.getAliases()).map(
    ([key, libPath]) => ({ key, libFolder: path.dirname(libPath) }),
  );

  if (libs.length === 0) {
    return;
  }

  rspackConfig.module ??= {};
  rspackConfig.module.rules ??= [];
  rspackConfig.module.rules.push({
    test: /\.[cm]?[jt]sx?$/,
    exclude: /node_modules/,
    // A post loader runs last, so it sees what Angular's transform emitted.
    enforce: 'post',
    use: [
      {
        loader: require.resolve('./shared-mappings-loader'),
        options: { libs },
      },
    ],
  });
}

function isServerConfig(config: Configuration): boolean {
  const target = config.target;
  return (
    target === 'node' ||
    target === 'async-node' ||
    (Array.isArray(target) && target.includes('node'))
  );
}
