import {
  ImportMap,
  Imports,
  mergeImportMaps,
  Scopes,
} from './model/import-map';
import { getExternalUrl, setExternalUrl } from './model/externals';
import { getDirectory, joinPaths } from './utils/path-utils';
import { addRemote } from './model/remotes';
import { appendImportMap } from './utils/add-import-map';
import {
  FederationInfo,
  InitFederationOptions,
} from './model/federation-info';
import { setOptions } from './utils/set-options';

/**
 * Initialize the federation runtime
 * @param remotesOrManifestUrl
 * @param options The cacheTag allows you to invalidate the cache of the remoteEntry.json files, pass a new value with every release (f.ex. the version number)
 */
export async function initFederation(
  remotesOrManifestUrl: Record<string, string> | string = {},
  optionsOverride?: Partial<InitFederationOptions>
): Promise<ImportMap> {
  const options = setOptions(optionsOverride);

  const cacheOption = options.cacheTag ? `?t=${options.cacheTag}` : '';
  
  const remotesPromise = typeof remotesOrManifestUrl === 'string'
    ? loadManifest(remotesOrManifestUrl + cacheOption)
    : Promise.resolve(remotesOrManifestUrl);

  const remotes = await remotesPromise;
  const remotesImportMap = await processRemoteInfos(remotes, options);

  let importMap: ImportMap;
  if (options.hostRemoteEntry) {
    const hostInfoPromise = loadFederationInfo(options.hostRemoteEntry + cacheOption);
    const hostInfo = await hostInfoPromise;
    const hostImportMap = await processHostInfo(hostInfo);
    importMap = mergeImportMaps(hostImportMap, remotesImportMap);
  } else {
    importMap = remotesImportMap;
  }

  appendImportMap(importMap);
  return importMap;
}

async function loadManifest(remotes: string): Promise<Record<string, string>> {
  return (await fetch(remotes).then((r) => r.json())) as Record<string, string>;
}

export async function processRemoteInfos(
  remotes: Record<string, string>,
  optionsOverride?: Partial<InitFederationOptions>
): Promise<ImportMap> {
  const options = setOptions(optionsOverride);

  const processRemoteInfoPromises = Object.keys(remotes).map(
    async (remoteName) => {
      try {
        let url = remotes[remoteName];
        if (options.cacheTag) {
          const addAppend = remotes[remoteName].includes('?') ? '&' : '?';
          url += `${addAppend}t=${options.cacheTag}`;
        }

        return await processRemoteInfo(url, remoteName);
      } catch (e) {
        const error = `Error loading remote entry for ${remoteName} from file ${remotes[remoteName]}`;

        if (options.throwIfRemoteNotFound) {
          throw new Error(error);
        }

        console.error(error);
        return null;
      }
    }
  );

  const remoteImportMaps = await Promise.all(processRemoteInfoPromises);

  const importMap = remoteImportMaps.reduce<ImportMap>(
    (acc, remoteImportMap) =>
      remoteImportMap ? mergeImportMaps(acc, remoteImportMap) : acc,
    { imports: {}, scopes: {} }
  );

  return importMap;
}

export async function processRemoteInfo(
  federationInfoUrl: string,
  remoteName?: string
): Promise<ImportMap> {
  const baseUrl = getDirectory(federationInfoUrl);
  const remoteInfo = await loadFederationInfo(federationInfoUrl);

  if (!remoteName) {
    remoteName = remoteInfo.name;
  }

  const importMap = createRemoteImportMap(remoteInfo, remoteName, baseUrl);
  addRemote(remoteName, { ...remoteInfo, baseUrl });

  return importMap;
}

function createRemoteImportMap(
  remoteInfo: FederationInfo,
  remoteName: string,
  baseUrl: string
): ImportMap {
  const imports = processExposed(remoteInfo, remoteName, baseUrl);
  const scopes = processRemoteImports(remoteInfo, baseUrl);
  return { imports, scopes };
}

async function loadFederationInfo(url: string): Promise<FederationInfo> {
  const info = (await fetch(url).then((r) => r.json())) as FederationInfo;
  return info;
}

function processRemoteImports(
  remoteInfo: FederationInfo,
  baseUrl: string
): Scopes {
  const scopes: Scopes = {};
  const scopedImports: Imports = {};

  for (const shared of remoteInfo.shared) {
    const outFileName =
      getExternalUrl(shared) ?? joinPaths(baseUrl, shared.outFileName);
    setExternalUrl(shared, outFileName);
    scopedImports[shared.packageName] = outFileName;
  }

  scopes[baseUrl + '/'] = scopedImports;
  return scopes;
}

function processExposed(
  remoteInfo: FederationInfo,
  remoteName: string,
  baseUrl: string
): Imports {
  const imports: Imports = {};

  for (const exposed of remoteInfo.exposes) {
    const key = joinPaths(remoteName, exposed.key);
    const value = joinPaths(baseUrl, exposed.outFileName);
    imports[key] = value;
  }

  return imports;
}

export async function processHostInfo(
  hostInfo: FederationInfo,
  relBundlesPath = './'
): Promise<ImportMap> {
  const imports = hostInfo.shared.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.packageName]: relBundlesPath + cur.outFileName,
    }),
    {}
  ) as Imports;

  for (const shared of hostInfo.shared) {
    setExternalUrl(shared, relBundlesPath + shared.outFileName);
  }
  return { imports, scopes: {} };
}
