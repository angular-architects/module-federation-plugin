// TODO: Move FederationInfo to common lib
import { FederationInfo } from '@angular-architects/native-federation';
import { Scopes, Imports, ImportMap } from './import-map';
import { getExternalUrl, setExternalUrl } from './externals';
import { joinPaths, getDirectory } from './utils';

// remoteName -> remoteUrl
const remotes = new Map<string, string>();

export async function initFederation(remotes: Record<string, string> = {}) {
    const hostImports = await processHostInfo();
    const importMap = await processRemoteInfos(remotes, hostImports);

    document.body.appendChild(Object.assign(document.createElement('script'), {
        type: 'importmap-shim',
        innerHTML: JSON.stringify(importMap),
    }));
}

async function processRemoteInfos(remotes: Record<string, string>, imports: Imports): Promise<ImportMap> {
  const scopes = {} as Scopes;

  for (const remoteName of Object.keys(remotes)) {
    const url = remotes[remoteName];
    const baseUrl = getDirectory(url);

    const remoteInfo = await loadFederationInfo(url);

    processExposed(remoteInfo, remoteName, baseUrl, imports);
    processRemoteImports(remoteInfo, baseUrl, scopes);
  }

  return { imports, scopes };
}

async function loadFederationInfo(url: string) {
  return await fetch(url).then(r => r.json()) as FederationInfo;
}

function processRemoteImports(remoteInfo: FederationInfo, baseUrl: string, scopes: Scopes) {
  const scopedImports: Imports = {};

  for (const shared of remoteInfo.shared) {

    const outFileName = getExternalUrl(shared) ?? joinPaths(baseUrl, shared.outFileName);
    setExternalUrl(shared, outFileName);
    scopedImports[shared.packageName] = outFileName;
  }

  scopes[baseUrl + '/'] = scopedImports;
}

function processExposed(remoteInfo: FederationInfo, remoteName: string, baseUrl: string, imports: Imports) {
  for (const exposed of remoteInfo.exposes) {
    const key = joinPaths(remoteName, exposed.key);
    const value = joinPaths(baseUrl, exposed.outFileName);
    imports[key] = value;
  }
}

async function processHostInfo() {
  const hostInfo = await loadFederationInfo('./remoteEntry.json');
  
  const imports = hostInfo.shared.reduce((acc, cur) => ({ ...acc, [cur.packageName]: './' + cur.outFileName }), {}) as Imports;

  for (const shared of hostInfo.shared) {
    setExternalUrl(shared, './' + shared.outFileName);
  }
  return imports;
}
