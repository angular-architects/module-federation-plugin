import type { Configuration } from '@rspack/core';
import { Shared } from '@rspack/core/dist/sharing/SharePlugin';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import { applySkipList, normalizeSkipList, SkipList } from '../utils/skip-list';
import { findRootTsConfigJson, SharedMappings } from '../webpack';

export type FederationOptions = {
  name?: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Shared;
};

export type FederationConfig = {
  options: FederationOptions;
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
  const { skip, ...mfConfig } = federationConfig;
  const normalizedSkip = normalizeSkipList(skip);

  const mappings = new SharedMappings();
  mappings.register(findRootTsConfigJson());

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

  rspackConfig.plugins ??= [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rspackConfig.plugins.push(mappings.getPlugin() as any);
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

function isServerConfig(config: Configuration): boolean {
  const target = config.target;
  return (
    target === 'node' ||
    target === 'async-node' ||
    (Array.isArray(target) && target.includes('node'))
  );
}
