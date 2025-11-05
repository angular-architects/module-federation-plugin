import { ModuleFederationConfig, RsbuildConfig } from '@rsbuild/core';
import { pluginScriptModule } from './plugin-script-module';
import { applySkipList, normalizeSkipList, SkipList } from '../utils/skip-list';
import { Shared } from '@rspack/core/dist/sharing/SharePlugin';
import { findRootTsConfigJson, SharedMappings } from '../webpack';

export type FederationConfig = {
  options: FederationOptions;
  skip?: SkipList;
};

export type FederationOptions = Omit<
  ModuleFederationConfig['options'],
  'name'
> & {
  name?: string;
};

export function withFederation(config: FederationConfig) {
  //
  // This provides partial application for better DX,
  // as it allows to split the config into a file with
  // rsbuild and an other one with federation settings
  //
  return (rsbuildConfig: RsbuildConfig) => {
    return applyFederation(rsbuildConfig, config);
  };
}

export function applyFederation(
  rsbuildConfig: RsbuildConfig,
  federationConfig: FederationConfig
): RsbuildConfig {
  const { skip, ...mfConfig } = federationConfig;
  const normalizedSkip = normalizeSkipList(skip);
  const mappings = new SharedMappings();
  mappings.register(findRootTsConfigJson());

  const shared = (mfConfig.options.shared ?? {}) as Shared;
  const sharedWithLibs = {
    ...mappings.getDescriptors(),
    ...shared,
  };

  const filteredSkipList = applySkipList(normalizedSkip, sharedWithLibs);

  mfConfig.options.shared = filteredSkipList as Shared;

  const config: RsbuildConfig = {
    ...rsbuildConfig,
    resolve: {
      ...rsbuildConfig.resolve,
      alias: {
        ...rsbuildConfig.resolve?.alias,
        ...mappings.getAliases(),
      },
    },
    dev: {
      ...rsbuildConfig.dev,
      // chunkFormat: 'module' does not work with hmr yet
      hmr: false,
    },
    server: {
      ...rsbuildConfig.server,
      cors: true,
    },
    plugins: [
      ...(rsbuildConfig.plugins ?? []),
      // mappings.getPlugin(),

      pluginScriptModule(),
    ],
    tools: {
      rspack: {
        experiments: {
          outputModule: true,
        },
        plugins: [mappings.getPlugin()],
        output: {
          uniqueName: mfConfig.options.name,
          publicPath: 'auto',
          chunkFormat: 'module',
          chunkLoading: 'import',
          workerChunkLoading: 'import',
          wasmLoading: 'fetch',
          library: { type: 'module' },
          module: true,
        },
        optimization: {
          runtimeChunk: 'single',
        },
      },
    },
    moduleFederation: {
      ...mfConfig,
      options: {
        //
        // Shells use an empty name by default
        // Alternative: Specifiying the *same* name
        // in initFederation (runtime) and
        // withFederation (build time)
        //
        name: '',
        ...mfConfig.options,
        library: {
          ...mfConfig.options.library,
          type: 'module',
        },
        remoteType: 'module',
        filename: 'remoteEntry.js',
      },
    },
  };

  return config;
}
