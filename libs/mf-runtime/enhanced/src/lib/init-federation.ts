import { init } from '@module-federation/enhanced/runtime';
import { ModuleFederation, UserOptions } from '@module-federation/runtime-core';

export type ManifestFile<T extends RemoteConfig = RemoteConfig> = {
  [key: string]: string | T;
};

export type Manifest<T extends RemoteConfig = RemoteConfig> = {
  [key: string]: T;
};

//
// remoteEntry is the original used by the orignal
// webpack-based plugin; entry is used by the new
// Module Federation Runtime. We support both to
// avoid confusion.
//
export type RemoteConfig =
  | {
      name: string;
      type: 'module' | 'script';
      remoteEntry: string;
      [key: string]: unknown;
    }
  | {
      name: string;
      type: 'module' | 'script';
      entry: string;
      [key: string]: unknown;
    };

export type InitFederationOptions = {
  runtimeOptions?: UserOptions;
};

let config: Manifest = {};

export async function initFederation(
  manifest: string | ManifestFile,
  options?: InitFederationOptions
): Promise<ModuleFederation> {
  if (typeof manifest === 'string') {
    config = await loadManifest(manifest);
  } else {
    config = parseConfig(manifest);
  }

  const runtimeConfig = toRuntimeConfig(config, options);
  return init(runtimeConfig as any) as any;
}

export function toRuntimeConfig(
  config: Manifest<RemoteConfig>,
  options?: InitFederationOptions
): UserOptions {
  return {
    //
    // The runtime assumes an empty string as the name for
    // the host. Alternatively, we have to pass the same
    // name to withFederation (compile time config) and
    // initFederation (runtime time config on app start)
    //
    name: '',
    ...options?.runtimeOptions,
    remotes: [
      ...(options?.runtimeOptions?.remotes ?? []),
      ...toRemotes(config),
    ],
  };
}

function toRemotes(config: Manifest) {
  return Object.values(config).map((c) => ({
    name: c.name,
    entry: (c.entry ?? c.remoteEntry ?? '') as string,
    type: c.type,
  }));
}

export function getManifest<T extends Manifest>(): T {
  return config as T;
}

//  Just needed to align with original webpack-based plugin
export async function setManifest(manifest: ManifestFile) {
  config = parseConfig(manifest);
}

export async function loadManifest<T extends Manifest = Manifest>(
  configFile: string
): Promise<T> {
  const result = await fetch(configFile);

  if (!result.ok) {
    throw Error('could not load configFile: ' + configFile);
  }

  config = parseConfig(await result.json());
  return config as T;
}

export function parseConfig(config: ManifestFile): Manifest {
  const result: Manifest = {};
  for (const key in config) {
    const value = config[key];

    let entry: RemoteConfig;
    if (typeof value === 'string') {
      entry = {
        name: key,
        remoteEntry: value,
        type: 'module',
      };
    } else {
      entry = {
        ...value,
        name: key,
        type: value.type || 'module',
      };
    }

    result[key] = entry;
  }
  return result;
}
