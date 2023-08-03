type Scope = unknown;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Factory = () => any;

type Container = {
  init(shareScope: Scope): void;
  get(module: string): Factory;
};

let config: Manifest = {};

export type ManifestFile<T extends RemoteConfig = RemoteConfig> = {
  [key: string]: string | T;
};

export type Manifest<T extends RemoteConfig = RemoteConfig> = {
  [key: string]: T;
};

export type RemoteConfig = {
  type: 'module' | 'script';
  remoteEntry: string;
  [key: string]: unknown;
};

declare const __webpack_init_sharing__: (shareScope: string) => Promise<void>;
declare const __webpack_share_scopes__: { default: Scope };

type ContainerMap = { [key: string]: Container };

const containerMap: ContainerMap = {};
const remoteMap = {};

let isDefaultScopeInitialized = false;

async function lookupExposedModule<T>(
  key: string,
  exposedModule: string
): Promise<T> {
  const container = containerMap[key];
  const factory = await container.get(exposedModule);
  const Module = factory();
  return Module as T;
}

async function initRemote(container: Container, key: string) {
  // const container = window[key] as Container;

  // Do we still need to initialize the remote?
  if (remoteMap[key]) {
    return container;
  }

  // Do we still need to initialize the share scope?
  if (!isDefaultScopeInitialized) {
    await __webpack_init_sharing__('default');
    isDefaultScopeInitialized = true;
  }

  await container.init(__webpack_share_scopes__.default);
  remoteMap[key] = true;
  return container;
}

export type LoadRemoteEntryOptions =
  | LoadRemoteEntryScriptOptions
  | LoadRemoteEntryEsmOptions;

export type LoadRemoteEntryScriptOptions = {
  type?: 'script';
  remoteEntry: string;
  remoteName: string;
};

export type LoadRemoteEntryEsmOptions = {
  type: 'module';
  remoteEntry: string;
};

export async function loadRemoteEntry(
  remoteEntry: string,
  remoteName: string
): Promise<void>;
export async function loadRemoteEntry(
  options: LoadRemoteEntryOptions
): Promise<void>;
export async function loadRemoteEntry(
  remoteEntryOrOptions: string | LoadRemoteEntryOptions,
  remoteName?: string
): Promise<void> {
  if (typeof remoteEntryOrOptions === 'string') {
    const remoteEntry = remoteEntryOrOptions;
    return await loadRemoteScriptEntry(remoteEntry, remoteName);
  } else if (remoteEntryOrOptions.type === 'script') {
    const options = remoteEntryOrOptions;
    return await loadRemoteScriptEntry(options.remoteEntry, options.remoteName);
  } else if (remoteEntryOrOptions.type === 'module') {
    const options = remoteEntryOrOptions;
    await loadRemoteModuleEntry(options.remoteEntry);
  }
}

async function loadRemoteModuleEntry(remoteEntry: string): Promise<void> {
  if (containerMap[remoteEntry]) {
    return Promise.resolve();
  }
  return await import(/* webpackIgnore:true */ remoteEntry).then(
    (container) => {
      initRemote(container, remoteEntry);
      containerMap[remoteEntry] = container;
    }
  );
}

async function loadRemoteScriptEntry(
  remoteEntry: string,
  remoteName: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Is remoteEntry already loaded?
    if (containerMap[remoteName]) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = remoteEntry;

    script.onerror = reject;

    script.onload = () => {
      const container = window[remoteName] as Container;
      initRemote(container, remoteName);
      containerMap[remoteName] = container;
      resolve();
    };

    document.body.appendChild(script);
  });
}

export type LoadRemoteModuleOptions =
  | LoadRemoteModuleScriptOptions
  | LoadRemoteModuleEsmOptions
  | LoadRemoteModuleManifestOptions;

export type LoadRemoteModuleScriptOptions = {
  type?: 'script';
  remoteEntry?: string;
  remoteName: string;
  exposedModule: string;
};

export type LoadRemoteModuleEsmOptions = {
  type: 'module';
  remoteEntry: string;
  exposedModule: string;
};

export type LoadRemoteModuleManifestOptions = {
  type: 'manifest';
  remoteName: string;
  exposedModule: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadRemoteModule<T = any>(
  remoteName: string,
  exposedModule: string
): Promise<T>;
export async function loadRemoteModule<T = any>(
  options: LoadRemoteModuleOptions
): Promise<T>;
export async function loadRemoteModule<T = any>(
  optionsOrRemoteName: LoadRemoteModuleOptions | string,
  exposedModule?: string
): Promise<T> {
  let loadRemoteEntryOptions: LoadRemoteEntryOptions;
  let key: string;
  let remoteEntry: string;
  let options: LoadRemoteModuleOptions;

  if (typeof optionsOrRemoteName === 'string') {
    options = {
      type: 'manifest',
      remoteName: optionsOrRemoteName,
      exposedModule: exposedModule,
    };
  } else {
    options = optionsOrRemoteName;
  }

  // To support legacy API (< ng 13)
  if (!options.type) {
    const hasManifest = Object.keys(config).length > 0;
    options.type = hasManifest ? 'manifest' : 'script';
  }

  if (options.type === 'manifest') {
    const manifestEntry = config[options.remoteName];
    if (!manifestEntry) {
      throw new Error('Manifest does not contain ' + options.remoteName);
    }
    options = {
      type: manifestEntry.type,
      exposedModule: options.exposedModule,
      remoteEntry: manifestEntry.remoteEntry,
      remoteName:
        manifestEntry.type === 'script' ? options.remoteName : undefined,
    };
    remoteEntry = manifestEntry.remoteEntry;
  } else {
    remoteEntry = options.remoteEntry;
  }

  if (options.type === 'script') {
    loadRemoteEntryOptions = {
      type: 'script',
      remoteEntry: options.remoteEntry,
      remoteName: options.remoteName,
    };
    key = options.remoteName;
  } else if (options.type === 'module') {
    loadRemoteEntryOptions = {
      type: 'module',
      remoteEntry: options.remoteEntry,
    };
    key = options.remoteEntry;
  }

  if (remoteEntry) {
    await loadRemoteEntry(loadRemoteEntryOptions);
  }

  return await lookupExposedModule<T>(key, options.exposedModule);
}

export async function setManifest(
  manifest: ManifestFile,
  skipRemoteEntries = false
) {
  config = parseConfig(manifest);

  if (!skipRemoteEntries) {
    await loadRemoteEntries();
  }
}

export function getManifest<T extends Manifest>(): T {
  return config as T;
}

export async function initFederation(
  manifest: string | ManifestFile,
  skipRemoteEntries = false
): Promise<void> {
  if (typeof manifest === 'string') {
    return loadManifest(manifest, skipRemoteEntries);
  } else {
    return setManifest(manifest, skipRemoteEntries);
  }
}

export async function loadManifest(
  configFile: string,
  skipRemoteEntries = false
): Promise<void> {
  const result = await fetch(configFile);

  if (!result.ok) {
    throw Error('could not load configFile: ' + configFile);
  }

  config = parseConfig(await result.json());

  if (!skipRemoteEntries) {
    await loadRemoteEntries();
  }
}

function parseConfig(config: ManifestFile): Manifest {
  const result: Manifest = {};
  for (const key in config) {
    const value = config[key];

    let entry: RemoteConfig;
    if (typeof value === 'string') {
      entry = {
        remoteEntry: value,
        type: 'module',
      };
    } else {
      entry = {
        ...value,
        type: value.type || 'module',
      };
    }

    result[key] = entry;
  }
  return result;
}

async function loadRemoteEntries() {
  const promises: Promise<void>[] = [];

  for (const key in config) {
    const entry = config[key];

    if (entry.type === 'module') {
      promises.push(
        loadRemoteEntry({ type: 'module', remoteEntry: entry.remoteEntry })
      );
    } else {
      promises.push(
        loadRemoteEntry({
          type: 'script',
          remoteEntry: entry.remoteEntry,
          remoteName: key,
        })
      );
    }
  }

  await Promise.all(promises);
}
