// TODO: Move FederationInfo to common lib
import { FederationInfo } from '@angular-architects/native-federation';
import { Scopes, Imports, ImportMap, mergeImportMaps } from './import-map';
import { getExternalUrl, setExternalUrl } from './externals';
import { joinPaths, getDirectory } from './utils';
import { addRemote } from './remotes';
import { appendImportMap } from './add-import-map';

export async function initFederation(remotes: Record<string, string> = {}): Promise<ImportMap> {
    const hostImportMap = await processHostInfo();
    const remotesImportMap = await processRemoteInfos(remotes);

    const importMap = mergeImportMaps(hostImportMap, remotesImportMap);

    appendImportMap(importMap);

    return importMap;
}

async function processRemoteInfos(remotes: Record<string, string>): Promise<ImportMap> {
  let importMap: ImportMap = {
    imports: {},
    scopes: {}
  };

  for (const remoteName of Object.keys(remotes)) {
    const url = remotes[remoteName];
    const remoteMap = await processRemoteInfo(url, remoteName);
    importMap = mergeImportMaps(importMap, remoteMap);
  }

  return importMap;
}

export async function processRemoteInfo(federationInfoUrl: string, remoteName?: string): Promise<ImportMap> {
  const baseUrl = getDirectory(federationInfoUrl);
  const remoteInfo = await loadFederationInfo(federationInfoUrl);

  if (!remoteName) {
    remoteName = remoteInfo.name;
  }

  const importMap = createRemoteImportMap(remoteInfo, remoteName, baseUrl);
  addRemote(remoteName, {...remoteInfo, baseUrl})

  return importMap;
}

function createRemoteImportMap(remoteInfo: FederationInfo, remoteName: string, baseUrl: string): ImportMap {
  const imports = processExposed(remoteInfo, remoteName, baseUrl);
  const scopes = processRemoteImports(remoteInfo, baseUrl);
  return { imports, scopes };
}

async function loadFederationInfo(url: string): Promise<FederationInfo> {
  const info = await fetch(url).then(r => r.json()) as FederationInfo;
  return info;
}

function processRemoteImports(remoteInfo: FederationInfo, baseUrl: string): Scopes {
  const scopes: Scopes = {};
  const scopedImports: Imports = {};

  for (const shared of remoteInfo.shared) {

    const outFileName = getExternalUrl(shared) ?? joinPaths(baseUrl, shared.outFileName);
    setExternalUrl(shared, outFileName);
    scopedImports[shared.packageName] = outFileName;
  }

  scopes[baseUrl + '/'] = scopedImports;
  return scopes;
}

function processExposed(remoteInfo: FederationInfo, remoteName: string, baseUrl: string): Imports {
  const imports: Imports = {};

  for (const exposed of remoteInfo.exposes) {
    const key = joinPaths(remoteName, exposed.key);
    const value = joinPaths(baseUrl, exposed.outFileName);
    imports[key] = value;
  }

  return imports;
}

async function processHostInfo(): Promise<ImportMap> {
  const hostInfo = await loadFederationInfo('./remoteEntry.json');
  
  const imports = hostInfo.shared.reduce((acc, cur) => ({ ...acc, [cur.packageName]: './' + cur.outFileName }), {}) as Imports;

  for (const shared of hostInfo.shared) {
    setExternalUrl(shared, './' + shared.outFileName);
  }
  return { imports, scopes: {} };
}
