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
const remoteMap: { [key: string]: boolean } = {};

let isDefaultScopeInitialized = false;

async function lookupExposedModule<T>(
  key: string,
  exposedModule: string,
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
  LoadRemoteEntryScriptOptions | LoadRemoteEntryEsmOptions;

export type LoadRemoteEntryScriptOptions = {
  type?: 'script';
  remoteEntry: string;
  remoteName: string;
  nonce?: string;
};

export type LoadRemoteEntryEsmOptions = {
  type: 'module';
  remoteEntry: string;
};

export async function loadRemoteEntry(
  remoteEntry: string,
  remoteName: string,
): Promise<void>;
export async function loadRemoteEntry(
  options: LoadRemoteEntryOptions,
): Promise<void>;
export async function loadRemoteEntry(
  remoteEntryOrOptions: string | LoadRemoteEntryOptions,
  remoteName?: string,
  nonce?: string,
): Promise<void> {
  if (typeof remoteEntryOrOptions === 'string') {
    const remoteEntry = remoteEntryOrOptions;
    if (!remoteName) {
      throw new Error(`No remoteName passed for remote entry "${remoteEntry}"`);
    }
    return await loadRemoteScriptEntry(remoteEntry, remoteName, nonce);
  } else if (remoteEntryOrOptions.type === 'script') {
    const options = remoteEntryOrOptions;
    return await loadRemoteScriptEntry(
      options.remoteEntry,
      options.remoteName,
      options.nonce,
    );
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
    },
  );
}

async function loadRemoteScriptEntry(
  remoteEntry: string,
  remoteName: string,
  nonce?: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Is remoteEntry already loaded?
    if (containerMap[remoteName]) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = remoteEntry;
    if (nonce) {
      script.setAttribute('nonce', nonce);
    }

    script.onerror = reject;

    script.onload = () => {
      const container = (window as unknown as Record<string, unknown>)[
        remoteName
      ] as Container;
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
  nonce?: string;
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

// `LoadRemoteModuleOptions` after the manifest lookup and the legacy defaulting
// have been applied, so `type` is always one of the two loadable variants.
type ResolvedRemoteModuleOptions =
  | {
      type: 'script';
      remoteEntry?: string;
      remoteName: string;
      exposedModule: string;
      nonce?: string;
    }
  | { type: 'module'; remoteEntry: string; exposedModule: string };

function resolveManifestEntry(
  remoteName: string,
  exposedModule: string,
): ResolvedRemoteModuleOptions {
  const manifestEntry = config[remoteName];

  if (!manifestEntry) {
    throw new Error('Manifest does not contain ' + remoteName);
  }

  // The manifest is fetched at runtime and parseConfig does not validate it, so
  // `type` is only nominally 'module' | 'script'.
  const type: string = manifestEntry.type;

  if (type === 'script') {
    return {
      type: 'script',
      remoteEntry: manifestEntry.remoteEntry,
      remoteName,
      exposedModule,
    };
  }

  if (type === 'module') {
    return {
      type: 'module',
      remoteEntry: manifestEntry.remoteEntry,
      exposedModule,
    };
  }

  throw new Error(
    `Unsupported type "${type}" for remote "${remoteName}" - expected "module" or "script"`,
  );
}

function resolveOptions(
  optionsOrRemoteName: LoadRemoteModuleOptions | string,
  exposedModule?: string,
): ResolvedRemoteModuleOptions {
  if (typeof optionsOrRemoteName === 'string') {
    if (!exposedModule) {
      throw new Error(
        `No exposedModule passed for remote "${optionsOrRemoteName}"`,
      );
    }
    return resolveManifestEntry(optionsOrRemoteName, exposedModule);
  }

  const options = optionsOrRemoteName;

  if (options.type === 'module') {
    return options;
  }

  if (options.type === 'manifest') {
    return resolveManifestEntry(options.remoteName, options.exposedModule);
  }

  // To support legacy API (< ng 13): a missing type means manifest whenever one
  // is loaded, and script otherwise.
  if (!options.type && Object.keys(config).length > 0) {
    return resolveManifestEntry(options.remoteName, options.exposedModule);
  }

  const type: string = options.type ?? 'script';
  if (type !== 'script') {
    throw new Error(
      `Unsupported type "${type}" for remote "${options.remoteName}" - expected "module" or "script"`,
    );
  }

  return { ...options, type: 'script' };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadRemoteModule<T = any>(
  remoteName: string,
  exposedModule: string,
): Promise<T>;
export async function loadRemoteModule<T = any>(
  options: LoadRemoteModuleOptions,
): Promise<T>;
export async function loadRemoteModule<T = any>(
  optionsOrRemoteName: LoadRemoteModuleOptions | string,
  exposedModule?: string,
): Promise<T> {
  const options = resolveOptions(optionsOrRemoteName, exposedModule);

  const key =
    options.type === 'script' ? options.remoteName : options.remoteEntry;

  const remoteEntry = options.remoteEntry;
  if (remoteEntry) {
    await loadRemoteEntry(
      options.type === 'script'
        ? {
            type: 'script',
            remoteEntry,
            remoteName: options.remoteName,
            nonce: options.nonce,
          }
        : { type: 'module', remoteEntry },
    );
  }

  return await lookupExposedModule<T>(key, options.exposedModule);
}

export async function setManifest(
  manifest: ManifestFile,
  skipRemoteEntries = false,
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
  skipRemoteEntries = false,
): Promise<void> {
  if (typeof manifest === 'string') {
    return loadManifest(manifest, skipRemoteEntries);
  } else {
    return setManifest(manifest, skipRemoteEntries);
  }
}

export async function loadManifest(
  configFile: string,
  skipRemoteEntries = false,
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
        loadRemoteEntry({ type: 'module', remoteEntry: entry.remoteEntry }),
      );
    } else {
      promises.push(
        loadRemoteEntry({
          type: 'script',
          remoteEntry: entry.remoteEntry,
          remoteName: key,
        }),
      );
    }
  }

  await Promise.all(promises);
}
