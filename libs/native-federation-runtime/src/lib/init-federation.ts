import {
  Scopes,
  Imports,
  ImportMap,
  mergeImportMaps,
} from './model/import-map';
import { joinPaths, getDirectory } from './utils/path-utils';
import { addRemote } from './model/remotes';
import { FederationInfo } from './model/federation-info';
import * as semver from 'semver';

export async function initFederation(
  remotesOrManifestUrl: Record<string, string> | string = {}
): Promise<ImportMap> {
  const remotes =
    typeof remotesOrManifestUrl === 'string'
      ? await loadManifest(remotesOrManifestUrl)
      : remotesOrManifestUrl;

  const hostImportMap = await processHostInfo();
  importShim.addImportMap(hostImportMap);
  const remotesImportMap = await processRemoteInfos(remotes);
  importShim.addImportMap(remotesImportMap);
  return importShim.getImportMap();
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
  const importMap = importShim.getImportMap();

  for (const shared of remoteInfo.shared) {
    let isImported = false;
    if (shared.singleton) {
      try {
        const importedURL = new URL(importMap.imports?.[shared.packageName]);
        const version = importedURL.searchParams.get('version');
        if (version) {
          isImported = semver.satisfies(version, shared.requiredVersion);
        }
      }
      catch {}
    }
    if (!isImported) {
      const outFileName = joinPaths(baseUrl, shared.outFileName);
      scopedImports[shared.packageName] = outFileName;
    }
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

async function processHostInfo(): Promise<ImportMap> {
  const hostInfo = await loadFederationInfo('./remoteEntry.json');

  const imports = hostInfo.shared.reduce(
    (acc, cur) => ({ ...acc, [cur.packageName]: cur.version ? `./${cur.outFileName}?version=${cur.version}` : `./${cur.outFileName}` }),
    {}
  ) as Imports;
  
  return { imports, scopes: {} };
}
