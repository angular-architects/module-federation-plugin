import {
  Scopes,
  Imports,
  ImportMap,
  mergeImportMaps,
} from './model/import-map';
import { getExternalUrl, setExternalUrl } from './model/externals';
import { joinPaths, getDirectory } from './utils/path-utils';
import { addRemote } from './model/remotes';
import { appendImportMap } from './utils/add-import-map';
import { FederationInfo } from './model/federation-info';

export async function initFederation(
  remotesOrManifestUrl: Record<string, string> | string = {}
): Promise<ImportMap> {
  const remotes =
    typeof remotesOrManifestUrl === 'string'
      ? await loadManifest(remotesOrManifestUrl)
      : remotesOrManifestUrl;

  const hostInfo = await loadFederationInfo('./remoteEntry.json');
  const hostImportMap = await processHostInfo(hostInfo);
  const remotesImportMap = await processRemoteInfos(remotes);

  const importMap = mergeImportMaps(hostImportMap, remotesImportMap);
  appendImportMap(importMap);

  return importMap;
}

async function loadManifest(remotes: string): Promise<Record<string, string>> {
  return (await fetch(remotes).then((r) => r.json())) as Record<string, string>;
}

export async function processRemoteInfos(
  remotes: Record<string, string>
): Promise<ImportMap> {
  const processRemoteInfoPromises = Object.keys(remotes).map(
    async (remoteName) => {
      try {
        const url = remotes[remoteName];
        return await processRemoteInfo(url, remoteName);
      } catch (e) {
        console.error(
          `Error loading remote entry for ${remoteName} from file ${remotes[remoteName]}`
        );
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

export async function processHostInfo(hostInfo: FederationInfo, relBundlesPath = './'): Promise<ImportMap> {

  const imports = hostInfo.shared.reduce(
    (acc, cur) => ({ ...acc, [cur.packageName]: relBundlesPath + cur.outFileName }),
    {}
  ) as Imports;

  for (const shared of hostInfo.shared) {
    setExternalUrl(shared, relBundlesPath + shared.outFileName);
  }
  return { imports, scopes: {} };
}
