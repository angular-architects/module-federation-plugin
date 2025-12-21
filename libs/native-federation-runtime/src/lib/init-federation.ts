import { getExternalUrl, setExternalUrl } from './model/externals';
import {
  FederationInfo,
  InitFederationOptions,
  ProcessRemoteInfoOptions,
} from './model/federation-info';
import {
  ImportMap,
  Imports,
  mergeImportMaps,
  Scopes,
} from './model/import-map';
import { addRemote } from './model/remotes';
import { appendImportMap } from './utils/add-import-map';
import { getDirectory, joinPaths } from './utils/path-utils';
import { watchFederationBuildCompletion } from './watch-federation-build';

/**
 * Initializes the Native Federation runtime for the host application.
 *
 * This is the main entry point for setting up federation. It performs the following:
 * 1. Loads the host's remoteEntry.json to discover shared dependencies
 * 2. Loads each remote's remoteEntry.json to discover exposed modules
 * 3. Creates an ES Module import map with proper scoping
 * 4. Injects the import map into the DOM as a <script type="importmap-shim">
 *
 * The import map allows dynamic imports to resolve correctly:
 * - Host shared deps go in root imports (e.g., "angular": "./angular.js")
 * - Remote exposed modules go in root imports (e.g., "mfe1/Component": "http://...")
 * - Remote shared deps go in scoped imports for proper resolution
 *
 * @param remotesOrManifestUrl - Either:
 *   - A record of remote names to their remoteEntry.json URLs
 *     Example: { mfe1: 'http://localhost:3000/remoteEntry.json' }
 *   - A URL to a manifest.json that contains the remotes record
 *     Example: 'http://localhost:3000/federation-manifest.json'
 *
 * @param options - Configuration options:
 *   - cacheTag: A version string to append as query param for cache busting
 *     Example: { cacheTag: 'v1.0.0' } results in '?t=v1.0.0' on all requests
 *
 * @returns The final merged ImportMap that was injected into the DOM
 *
 */
export async function initFederation(
  remotesOrManifestUrl: Record<string, string> | string = {},
  options?: InitFederationOptions,
): Promise<ImportMap> {
  const cacheTag = options?.cacheTag ? `?t=${options.cacheTag}` : '';

  const normalizedRemotes =
    typeof remotesOrManifestUrl === 'string'
      ? await loadManifest(remotesOrManifestUrl + cacheTag)
      : remotesOrManifestUrl;

  const hostInfo = await loadFederationInfo(`./remoteEntry.json${cacheTag}`);

  const hostImportMap = await processHostInfo(hostInfo);

  // Host application is fully loaded, now we can process the remotes

  // Each remote contributes:
  // - Exposed modules to root imports
  // - Shared dependencies to scoped imports
  const remotesImportMap = await fetchAndRegisterRemotes(normalizedRemotes, {
    throwIfRemoteNotFound: false,
    ...options,
  });

  const mergedImportMap = mergeImportMaps(hostImportMap, remotesImportMap);

  // Inject the final import map into the DOM with importmap-shim
  appendImportMap(mergedImportMap);

  return mergedImportMap;
}

/**
 * Loads a federation manifest file (JSON) from the given URL.
 *
 * The manifest should map remote names to their remoteEntry.json URLs.
 *
 * @param manifestUrl - The URL to the manifest.json file.
 * @returns A promise resolving to an object mapping remote names to their remoteEntry.json URLs.
 */
async function loadManifest(
  manifestUrl: string,
): Promise<Record<string, string>> {
  const manifest = (await fetch(manifestUrl).then((r) => r.json())) as Record<
    string,
    string
  >;
  return manifest;
}

/**
 * Adds cache busting query parameter to a URL if cacheTag is provided.
 */
function applyCacheTag(url: string, cacheTag?: string): string {
  if (!cacheTag) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${cacheTag}`;
}

/**
 * Handles errors when loading a remote entry.
 * Either throws or logs based on options.
 */
function handleRemoteLoadError(
  remoteName: string,
  remoteUrl: string,
  options: ProcessRemoteInfoOptions,
  originalError: Error,
): null {
  const errorMessage = `Error loading remote entry for ${remoteName} from file ${remoteUrl}`;

  if (options.throwIfRemoteNotFound) {
    throw new Error(errorMessage);
  }

  console.error(errorMessage);
  console.error(originalError);
  return null;
}

/**
 * Fetches and registers multiple remote applications in parallel and merges their import maps.
 *
 * This function is the orchestrator for loading all remotes. It:
 * 1. Creates a promise for each remote to load its remoteEntry.json
 * 2. Applies cache busting to each remote URL
 * 3. Handles errors gracefully (logs or throws based on options)
 * 4. Merges all successful remote import maps into one
 *
 * Each remote contributes:
 * - Its exposed modules to the root imports
 * - Its shared dependencies to scoped imports
 *
 * @param remotes - Record of remote names to their remoteEntry.json URLs
 * @param options - Processing options including:
 *   - throwIfRemoteNotFound: Whether to throw or log on remote load failure
 *   - cacheTag: Cache busting tag to append to URLs
 *
 * @returns Merged import map containing all remotes' contributions
 *
 */

export async function fetchAndRegisterRemotes(
  remotes: Record<string, string>,
  options: ProcessRemoteInfoOptions = { throwIfRemoteNotFound: false },
): Promise<ImportMap> {

  // Each promise will independently fetch and process its remoteEntry.json
  const fetchAndRegisterRemotePromises = Object.entries(remotes).map(
    async ([remoteName, remoteUrl]): Promise<ImportMap | null> => {
      try {

        const urlWithCache = applyCacheTag(remoteUrl, options.cacheTag);

        return await fetchAndRegisterRemote(urlWithCache, remoteName);
      } catch (e) {
        return handleRemoteLoadError(
          remoteName,
          remoteUrl,
          options,
          e as Error,
        );
      }
    },
  );

  const remoteImportMaps = await Promise.all(fetchAndRegisterRemotePromises);

  // Filter out failed remotes (null values) and merge successful ones
  const importMap = remoteImportMaps.reduce<ImportMap>(
    (acc, remoteImportMap) =>
      remoteImportMap ? mergeImportMaps(acc, remoteImportMap) : acc,
    { imports: {}, scopes: {} },
  );

  return importMap;
}

/**
 * Fetches a single remote application's remoteEntry.json file and registers it in the system (global registry).
 *
 * This function handles everything needed to integrate one remote:
 * 1. Fetches the remote's remoteEntry.json file
 * 2. Extracts the base URL from the remoteEntry path
 * 3. Creates import map entries for exposed modules and shared deps
 * 4. Registers the remote in the global remotes registry
 * 5. Sets up hot reload watching if configured (development mode)
 *
 * @param federationInfoUrl - Full URL to the remote's remoteEntry.json
 * @param remoteName - Name to use for this remote (optional, uses info.name if not provided)
 *
 * @returns Import map containing this remote's exposed modules and shared dependencies
 *
 * @example
 * ```typescript
 * const importMap = await fetchAndRegisterRemote(
 *   'http://localhost:3000/mfe1/remoteEntry.json',
 *   'mfe1'
 * );
 * // Result: {
 * //   imports: { 'mfe1/Component': 'http://localhost:3000/mfe1/Component.js' },
 * //   scopes: { 'http://localhost:3000/mfe1/': { 'lodash': '...' } }
 * // }
 * ```
 */
export async function fetchAndRegisterRemote(
  federationInfoUrl: string,
  remoteName?: string,
): Promise<ImportMap> {
  const baseUrl = getDirectory(federationInfoUrl);

  const remoteInfo = await loadFederationInfo(federationInfoUrl);

  // Uses the name from the remote's remoteEntry.json if not explicitly provided
  if (!remoteName) {
    remoteName = remoteInfo.name;
  }

  // Setup hot reload watching for development mode and in case it has a build notifications endpoint
  if (remoteInfo.buildNotificationsEndpoint) {
    watchFederationBuildCompletion(
      baseUrl + remoteInfo.buildNotificationsEndpoint,
    );
  }

  const importMap = createRemoteImportMap(remoteInfo, remoteName, baseUrl);

  // Register this remote in the global registry
  addRemote(remoteName, { ...remoteInfo, baseUrl });

  return importMap;
}

/**
 * Creates an import map for a remote application.
 *
 * The import map has two parts:
 * 1. Imports (root level): Maps remote's exposed modules
 *    Example: "mfe1/Component" -> "http://localhost:3000/mfe1/Component.js"
 *
 * 2. Scopes: Maps remote's shared dependencies within its scope
 *    Example: "http://localhost:3000/mfe1/": { "lodash": "http://localhost:3000/mfe1/lodash.js" }
 *
 * Scoping ensures that when a module from this remote imports 'lodash',
 * it gets the version from this remote's bundle, not another version.
 *
 * @param remoteInfo - Federation info from the remote's remoteEntry.json
 * @param remoteName - Name used to prefix exposed module keys
 * @param baseUrl - Base URL where the remote is hosted
 *
 * @returns Import map with imports and scopes for this remote
 */
function createRemoteImportMap(
  remoteInfo: FederationInfo,
  remoteName: string,
  baseUrl: string,
): ImportMap {
  const imports = processExposed(remoteInfo, remoteName, baseUrl);
  const scopes = processRemoteImports(remoteInfo, baseUrl);

  return { imports, scopes };
}

/**
 * Fetches and parses a remoteEntry.json file.
 *
 * The remoteEntry.json contains metadata about a federated module:
 * - name: The application name
 * - exposes: Array of modules this app exposes to others
 * - shared: Array of dependencies this app shares
 * - buildNotificationsEndpoint: Optional SSE endpoint for hot reload (development mode)
 *
 * @param remoteEntryUrl - URL to the remoteEntry.json file (can be relative or absolute)
 * @returns Parsed federation info object
 */
async function loadFederationInfo(
  remoteEntryUrl: string,
): Promise<FederationInfo> {
  const info = (await fetch(remoteEntryUrl).then((r) =>
    r.json(),
  )) as FederationInfo;
  return info;
}

/**
 * Processes a remote's shared dependencies into scoped import map entries.
 *
 * Shared dependencies need to be scoped to avoid version conflicts.
 * When a module from "http://localhost:3000/mfe1/" imports "lodash",
 * the import map scope ensures it gets the correct version.
 *
 * Scope structure:
 * {
 *   "http://localhost:3000/mfe1/": {
 *     "lodash": "http://localhost:3000/mfe1/lodash.js",
 *     "rxjs": "http://localhost:3000/mfe1/rxjs.js"
 *   }
 * }
 *
 * This function also manages external URLs - if a shared dependency
 * has already been loaded from another location, it can reuse that URL.
 *
 * @param remoteInfo - Federation info containing shared dependencies
 * @param baseUrl - Base URL of the remote (used as the scope key)
 *
 * @returns Scopes object mapping baseUrl to its shared dependencies
 */
function processRemoteImports(
  remoteInfo: FederationInfo,
  baseUrl: string,
): Scopes {
  const scopes: Scopes = {};
  const scopedImports: Imports = {};

  for (const shared of remoteInfo.shared) {
    // Check if this dependency already has an external URL registered
    // If not, construct the URL from the base path and output filename
    const outFileName =
      getExternalUrl(shared) ?? joinPaths(baseUrl, shared.outFileName);

    // Register this URL as the external location for this shared dependency
    // This allows other remotes to potentially reuse this version
    setExternalUrl(shared, outFileName);

    // Add to the scoped imports: package name -> full URL
    scopedImports[shared.packageName] = outFileName;
  }

  scopes[baseUrl + '/'] = scopedImports;

  return scopes;
}

/**
 * Processes a remote's exposed modules into root-level import map entries.
 *
 * Exposed modules are what the remote makes available to other applications.
 * They go in the root imports (not scoped) so any app can import them.
 *
 * Example exposed module:
 * - Remote 'mfe1' exposes './Component' from file 'Component.js'
 * - Results in: "mfe1/Component" -> "http://localhost:3000/mfe1/Component.js"
 *
 * This allows other apps to do:
 * ```typescript
 * import { Component } from 'mfe1/Component';
 * ```
 *
 * @param remoteInfo - Federation info containing exposed modules
 * @param remoteName - Name to prefix the exposed keys with
 * @param baseUrl - Base URL where the remote's files are hosted
 *
 * @returns Imports object mapping remote module keys to their URLs
 */
function processExposed(
  remoteInfo: FederationInfo,
  remoteName: string,
  baseUrl: string,
): Imports {
  const imports: Imports = {};

  for (const exposed of remoteInfo.exposes) {
    // Create the import key by joining remote name with the exposed key
    // Example: 'mfe1' + './Component' -> 'mfe1/Component'
    const key = joinPaths(remoteName, exposed.key);

    // Create the full URL to the exposed module's output file
    // Example: 'http://localhost:3000/mfe1' + 'Component.js' -> 'http://localhost:3000/mfe1/Component.js'
    const value = joinPaths(baseUrl, exposed.outFileName);

    imports[key] = value;
  }

  return imports;
}

/**
 * Processes the host application's federation info into an import map.
 *
 * The host app typically doesn't expose modules (it's the consumer),
 * but it does share dependencies that should be available to remotes.
 *
 * Host shared dependencies go in root-level imports (not scoped) because:
 * 1. The host loads first and establishes the base environment
 * 2. Remotes should prefer host versions to avoid duplication
 *
 * @param hostInfo - Federation info from the host's remoteEntry.json
 * @param relBundlesPath - Relative path to the host's bundle directory (default: './')
 *
 * @returns Import map with host's shared dependencies in root imports
 */
export async function processHostInfo(
  hostInfo: FederationInfo,
  relBundlesPath = './',
): Promise<ImportMap> {
  
  // Transform shared array into imports object
  const imports = hostInfo.shared.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.packageName]: relBundlesPath + cur.outFileName,
    }),
    {},
  ) as Imports;

  // Register external URLs for host's shared dependencies
  // This allows remotes to discover and potentially reuse these versions
  for (const shared of hostInfo.shared) {
    setExternalUrl(shared, relBundlesPath + shared.outFileName);
  }

  // Host doesn't have scopes - its shared deps are at root level
  return { imports, scopes: {} };
}
