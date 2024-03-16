import {
  Scopes,
  Imports,
  ImportMap,
  mergeImportMaps,
} from './model/import-map';
import { getExternalUrl, setExternalUrl } from './model/externals';
import { joinPaths, getDirectory, getFile } from './utils/path-utils';
import { addRemote } from './model/remotes';
import { appendImportMap } from './utils/add-import-map';
import { FederationInfo, SharedInfo } from './model/federation-info';

export async function initFederation(
  remotesOrManifestUrl: Record<string, string> | string = {}
): Promise<ImportMap> {
  const remotes =
    typeof remotesOrManifestUrl === 'string'
      ? await loadManifest(remotesOrManifestUrl)
      : remotesOrManifestUrl;

  const importMap = await processRemoteInfos(remotes);
  appendImportMap(importMap);

  return importMap;
}

async function loadManifest(remotes: string): Promise<Record<string, string>> {
  return (await fetch(remotes).then((r) => r.json())) as Record<string, string>;
}

async function processRemoteInfos(
  remotes: Record<string, string>
): Promise<ImportMap> {
  let importMap: ImportMap = {
    imports: {},
    scopes: {},
  };

  for (const remoteName of Object.keys(remotes)) {
    try {
      const url = remotes[remoteName];
      const remoteMap = await processRemoteInfo(url, remoteName);
      importMap = mergeImportMaps(importMap, remoteMap);
    } catch (e) {
      console.error(
        `Error loading remote entry for ${remoteName} from file ${remotes[remoteName]}`
      );
    }
  }

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
  const currentImportMap = importShim.getImportMap();

  for (const shared of remoteInfo.shared) {
    const defaultExternalUrl = getDefaultExternalUrl(currentImportMap, shared);

    // Do to process shared if the import already exist in the default list of the importmap
    if (defaultExternalUrl) {
      continue;
    }

    const outFileName =
      getExternalUrl(shared) ?? joinPaths(baseUrl, shared.outFileName);
    setExternalUrl(shared, outFileName);
    scopedImports[shared.packageName] = outFileName;
  }

  // Do not create specific scope section for a remote that does not have specific external version
  if (Object.keys(scopedImports).length > 0) {
    scopes[baseUrl + '/'] = scopedImports;
  }
  return scopes;
}

function getDefaultExternalUrl(
  hostImports: ImportMap,
  { packageName, outFileName }: SharedInfo
) {
  const hostImportUrlForShared = hostImports?.imports?.[packageName];
  const sharedUrlBundle = getFile(outFileName);

  return hostImportUrlForShared &&
    sharedUrlBundle &&
    hostImportUrlForShared.endsWith(sharedUrlBundle)
    ? hostImportUrlForShared
    : null;
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
