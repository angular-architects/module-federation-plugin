/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchAndRegisterRemote } from './init-federation';
import {
  getRemote,
  getRemoteNameByBaseUrl,
  isRemoteInitialized,
} from './model/remotes';
import { appendImportMap } from './utils/add-import-map';
import { getDirectory, joinPaths } from './utils/path-utils';

declare function importShim<T>(url: string): T;

/**
 * Options for loading a remote module.
 *
 * @template T - The expected type of the module's exports
 *
 * @property remoteEntry - Optional URL to the remote's remoteEntry.json file.
 *   Used for lazy-loading remotes that weren't registered during initFederation
 *   Example: 'http://localhost:3000/remoteEntry.json'
 *
 * @property remoteName - Optional name of the remote application.
 *   Should match the name used during initFederation or the name in remoteEntry.json.
 *   Example: 'mfe1'
 *
 * @property exposedModule - The key of the exposed module to load (required).
 *   Must match the key defined in the remote's federation config.
 *   Example: './Component' or './Dashboard'
 *
 * @property fallback - Optional fallback value to return if the remote or module cannot be loaded.
 *   Prevents throwing errors and provides graceful degradation.
 *   Example: A default component or null
 */
export type LoadRemoteModuleOptions<T = any> = {
  remoteEntry?: string;
  remoteName?: string;
  exposedModule: string;
  fallback?: T;
};

/**
 * Dynamically loads a remote module at runtime from a federated application.
 *
 * This is the primary API for consuming remote modules after federation has been initialized.
 * It supports two calling patterns:
 *
 * **Pattern 1: Using options object**
 * ```typescript
 * const module = await loadRemoteModule({
 *   remoteName: 'mfe1',
 *   exposedModule: './Component',
 *   fallback: DefaultComponent
 * });
 * ```
 *
 * **Pattern 2: Using positional arguments**
 * ```typescript
 * const module = await loadRemoteModule('mfe1', './Component');
 * ```
 *
 * ## Loading Process
 *
 * 1. **Normalize Options**: Converts arguments into a standard options object
 * 2. **Ensure Remote Initialized**: If remoteEntry is provided and remote isn't loaded,
 *    fetches and registers it dynamically
 * 3. **Resolve Remote Name**: Determines remote name from options or remoteEntry URL
 * 4. **Validate Remote**: Checks if remote exists in the registry
 * 5. **Validate Exposed Module**: Verifies the requested module is exposed by the remote
 * 6. **Import Module**: Uses dynamic import or import-shim to load the module
 * 7. **Handle Errors**: Returns fallback if provided, otherwise throws
 *
 * ## Lazy Loading Support
 *
 * If you provide a `remoteEntry` URL for a remote that wasn't initialized during
 * `initFederation()`, this function will automatically:
 * - Fetch the remote's remoteEntry.json
 * - Register it in the global registry
 * - Update the import map
 * - Then load the requested module
 *
 * This enables on-demand loading of remotes based on user interactions.
 *
 *
 * @template T - The expected type of the module's exports
 *
 * @param options - Configuration object for loading the remote module
 * @returns Promise resolving to the loaded module or fallback value
 *
 * @throws Error if remote is not found and no fallback is provided
 * @throws Error if exposed module doesn't exist and no fallback is provided
 * @throws Error if module import fails and no fallback is provided
 *
 */
export async function loadRemoteModule<T = any>(
  options: LoadRemoteModuleOptions,
): Promise<T>;
export async function loadRemoteModule<T = any>(
  remoteName: string,
  exposedModule: string,
): Promise<T>;
export async function loadRemoteModule<T = any>(
  optionsOrRemoteName: LoadRemoteModuleOptions<T> | string,
  exposedModule?: string,
): Promise<T> {


  const options = normalizeOptions(optionsOrRemoteName, exposedModule);

  await ensureRemoteInitialized(options);

  const remoteName = getRemoteNameByOptions(options);

  const remote = getRemote(remoteName);
  const fallback = options.fallback;

  // Handles errors when the remote is missing
  const remoteError = !remote ? 'unknown remote ' + remoteName : '';
  if (!remote && !fallback) throw new Error(remoteError);
  if (!remote) {
    logClientError(remoteError);
    return Promise.resolve(fallback);
  }

  const exposedModuleInfo = remote.exposes.find((e) => e.key === options.exposedModule);

  // Handles errors when the exposed module is missing
  const exposedError = !exposedModuleInfo
    ? `Unknown exposed module ${options.exposedModule} in remote ${remoteName}`
    : '';
  if (!exposedModuleInfo && !fallback) throw new Error(exposedError);
  if (!exposedModuleInfo) {
    logClientError(exposedError);
    return Promise.resolve(fallback);
  }

  const moduleUrl = joinPaths(remote.baseUrl, exposedModuleInfo.outFileName);

  try {
    const module = _import<T>(moduleUrl);
    return module;
  } catch (e) {
    // Handles errors when the module import fails
    if (fallback) {
      console.error('error loading remote module', e);
      return fallback;
    }
    throw e;
  }
}

/**
 * Internal helper function to perform the dynamic import.
 *
 * @template T - The expected type of the module's exports
 * @param moduleUrl - Full URL to the module file to import
 * @returns Promise resolving to the imported module
 */
function _import<T = any>(moduleUrl: string) {
  return typeof importShim !== 'undefined'
    ? importShim<T>(moduleUrl)
    : (import(/* @vite-ignore */ moduleUrl) as T);
}

/**
 * Resolves the remote name from the provided options.
 *
 * The remote name can be determined in two ways:
 * 1. If options.remoteName is provided, use it directly
 * 2. If only remoteEntry is provided, extract the baseUrl
 *    and look up the remote name from the registry using that baseUrl
 *
 * @param options - Load options containing remoteName and/or remoteEntry
 * @returns The resolved remote name
 *
 * @throws Error if neither remoteName nor remoteEntry is provided
 * @throws Error if the remote name cannot be determined
 */
function getRemoteNameByOptions(options: LoadRemoteModuleOptions) {
  let remoteName: string | undefined;

  if (options.remoteName) {
    remoteName = options.remoteName;
  } else if (options.remoteEntry) {
    const baseUrl = getDirectory(options.remoteEntry);
    remoteName = getRemoteNameByBaseUrl(baseUrl);
  } else {
    throw new Error(
      'unexpected arguments: Please pass remoteName or remoteEntry',
    );
  }

  if (!remoteName) {
    throw new Error('unknown remoteName ' + remoteName);
  }
  return remoteName;
}

/**
 * Ensures that the remote is initialized before attempting to load a module from it.
 *
 * This function enables lazy-loading of remotes that weren't registered during
 * the initial `initFederation()` call. It checks if:
 * 1. A remoteEntry URL is provided in the options
 * 2. The remote at that URL hasn't been initialized yet
 *
 * If both conditions are true, it:
 * 1. Fetches the remote's remoteEntry.json file
 * 2. Registers the remote in the global registry
 * 3. Creates and appends the remote's import map to the DOM
 *
 * @param options - Load options containing optional remoteEntry URL
 * @returns Promise that resolves when the remote is initialized (or immediately if already initialized)
 *
 */
async function ensureRemoteInitialized(
  options: LoadRemoteModuleOptions,
): Promise<void> {
  if (
    options.remoteEntry &&
    !isRemoteInitialized(getDirectory(options.remoteEntry))
  ) {
    const importMap = await fetchAndRegisterRemote(options.remoteEntry);
    appendImportMap(importMap);
  }
}

/**
 * Normalizes the function arguments into a standard LoadRemoteModuleOptions object.
 *
 * The function detects which pattern is being used and converts it to the
 * standard options object format for consistent internal processing.
 *
 * @param optionsOrRemoteName - Either an options object or the remote name string
 * @param exposedModule - The exposed module key
 * @returns Normalized options object
 *
 * @throws Error if arguments don't match either supported pattern
 */
function normalizeOptions(
  optionsOrRemoteName: string | LoadRemoteModuleOptions,
  exposedModule: string | undefined,
): LoadRemoteModuleOptions {
  let options: LoadRemoteModuleOptions;

  if (typeof optionsOrRemoteName === 'string' && exposedModule) {
    options = {
      remoteName: optionsOrRemoteName,
      exposedModule,
    };
  } else if (typeof optionsOrRemoteName === 'object' && !exposedModule) {
    options = optionsOrRemoteName;
  } else {
    throw new Error(
      'unexpected arguments: please pass options or a remoteName/exposedModule-pair',
    );
  }
  return options;
}

/**
 * Logs an error message to the console, but only in browser environments.
 *
 * @param error - The error message to log
 *
 */
function logClientError(error: string): void {
  if (typeof window !== 'undefined') {
    console.error(error);
  }
}
