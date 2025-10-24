import {
  DEFAULT_SECONARIES_SKIP_LIST,
  DEFAULT_SKIP_LIST,
  findRootTsConfigJson,
  shareAll,
} from './share-utils';
import { SharedMappings } from './shared-mappings';
import { ModifyEntryPlugin } from './modify-entry-plugin';

import ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

export function withModuleFederationPlugin(config: unknown) {
  const sharedMappings = config['sharedMappings'];
  delete config['sharedMappings'];

  const skip = [
    ...DEFAULT_SKIP_LIST,
    ...DEFAULT_SECONARIES_SKIP_LIST,
    ...(config['skip'] || []),
  ];

  delete config['skip'];

  if (sharedMappings) {
    sharedMappings.filter((m) => !skip.includes(m));
  }

  const mappings = new SharedMappings();
  mappings.register(findRootTsConfigJson(), sharedMappings);

  setDefaults(config, mappings, skip);
  const modifyEntryPlugin = createModifyEntryPlugin(config);

  const isModule = config['library']?.['type'] === 'module';

  // console.log('sharedConfig.modFed', sharedConfig.modFed);

  return {
    output: {
      publicPath: 'auto',
    },
    optimization: {
      runtimeChunk: false,
    },
    resolve: {
      alias: {
        ...mappings.getAliases(),
      },
    },
    ...(isModule
      ? {
          experiments: {
            outputModule: true,
          },
        }
      : {}),
    plugins: [
      new ModuleFederationPlugin(config),
      mappings.getPlugin(),
      ...(modifyEntryPlugin ? [modifyEntryPlugin] : []),
    ],
  };
}

function setDefaults(
  config: unknown,
  mappings: SharedMappings,
  skip: string[]
) {
  if (!config['library']) {
    config['library'] = {
      type: 'module',
    };
  }

  if (!config['filename']) {
    config['filename'] = 'remoteEntry.js';
  }

  if (!config['shared']) {
    config['shared'] = shareAll(
      {
        singleton: true,
        strictVersion: true,
        requiredVersion: 'auto',
      },
      skip
    );
  }

  if (typeof config['shared'] === 'object') {
    config['shared'] = {
      ...config['shared'],
      ...mappings.getDescriptors(),
    };
  }

  if (Array.isArray(config['shared'])) {
    config['shared'] = [...config['shared'], mappings.getDescriptors()];
  }
}

function createModifyEntryPlugin(config: unknown) {
  const pinned = [];
  const eager = [];
  for (const key in config['shared']) {
    const entry = config['shared'][key];
    if (entry.pinned) {
      pinned.push(key);
      delete entry.pinned;
    }
    if (entry.eager) {
      eager.push(key);
    }
  }
  const hasPinned = pinned.length > 0;
  const hasEager = eager.length > 0;

  if (hasPinned && config['remotes']) {
    throw new Error(
      [
        'Pinned dependencies in combination with build-time remotes are not allowed. ',
        'Either remove "pinned: true" from all shared dependencies or delete all ',
        'remotes in your webpack config and use runtime remote loading instead.',
      ].join('')
    );
  }

  const modifyEntryConfig = {};
  let modifyEntryPlugin = null;
  if (hasPinned) {
    modifyEntryConfig['main'] = { import: pinned };
  }

  if (hasEager) {
    modifyEntryConfig['styles'] = { dependOn: ['main'] };
    modifyEntryConfig['polyfills'] = { dependOn: ['main'] };
  }

  if (hasPinned || hasEager) {
    modifyEntryPlugin = new ModifyEntryPlugin(modifyEntryConfig);
  }
  return modifyEntryPlugin;
}
