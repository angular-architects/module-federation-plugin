import { FederationInfo, SharedInfo } from '@angular-architects/native-federation';
// import 'es-module-shims';

const externals = new Map<string, string>();
const remotes = new Map<string, string>();

export type Imports = Record<string, string>;
export type Scopes = Record<string, Imports>;

export async function initFederation(remotes: Record<string, string> = {}) {
    
    const hostInfo = await fetch('./remoteEntry.json').then(r => r.json()) as FederationInfo;
    const imports = hostInfo.shared.reduce( (acc, cur) => ({...acc, [cur.packageName]: './' + cur.outFileName }), {}) as Imports;
    const scopes = {} as Scopes;

    for (const shared of hostInfo.shared) {
      const key = getExternalKey(shared);
      externals.set(key, './' + shared.outFileName);
    }

    for (const remoteName of Object.keys(remotes))  {
      const url = remotes[remoteName];
      const baseUrl = directory(url);

      const remoteInfo = await fetch(url).then(r => r.json()) as FederationInfo;

      for (const exposed of remoteInfo.exposes) {
        const key = joinPaths(remoteName, exposed.key);
        const value = joinPaths(baseUrl, exposed.outFileName);
        imports[key] = value;
      }

      const scopedImports: Imports = {};

      for (const shared of remoteInfo.shared) {
        const externalKey = getExternalKey(shared);

        const outFileName = externals.get(externalKey) ?? joinPaths(baseUrl, shared.outFileName);
        externals.set(externalKey, outFileName);
        scopedImports[shared.packageName] = outFileName;
      }

      scopes[baseUrl + '/'] = scopedImports;

    }

    // importShim.addImportMap(importMap);
    
    document.body.appendChild(Object.assign(document.createElement('script'), {
        type: 'importmap-shim',
        innerHTML: JSON.stringify({ imports, scopes }),
    }));

    // window.importShim
}

function getExternalKey(shared: SharedInfo) {
  return `${shared.packageName}@${shared.version}`;
}

function directory(url: string) {
  const parts = url.split('/');
  parts.pop();
  return parts.join('/');
}

function joinPaths(path1: string, path2: string): string {
  while (path1.endsWith('/')) {
    path1 = path1.substring(0, path1.length - 1);
  }
  if (path2.startsWith('./')) {
    path2 = path2.substring(2, path2.length)
  }

  return `${path1}/${path2}`;
}
