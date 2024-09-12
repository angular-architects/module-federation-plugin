import { joinPaths, getDirectory } from './utils/path-utils';

let manifestObject: Record<string, string> = {};
const remoteEntryJsonMap: Record<string, Record<string, unknown>> = {};
const saveModuleByUrl: Record<string, string> = {};
export function setManifestObjectForSsr(manifest: Record<string, string>) {
  manifestObject = manifest;
}

export function hasRemoteSsr(name: string): boolean {
  if (!name.startsWith('http')) return false;

  const remoteEntryUrl = getRemoteEntry(name);
  const hasRemoteEntryUrl = Object.values(manifestObject).some(
    (i) => i === remoteEntryUrl
  );
  if (!hasRemoteEntryUrl) throw new Error('unknown remote ' + name);

  return true;
}

export async function loadModule(url: string) {
  if (saveModuleByUrl[url]) return saveModuleByUrl[url];

  const result = await fetch(url).then((r) => r.text());

  saveModuleByUrl[url] = result;
  return result;
}

const getRemoteEntry = (url: string) =>
  new URL('remoteEntry.json', new URL(url).origin).toString();

export async function getModuleNameByUrl(url: string) {
  const remoteEntryUrl = getRemoteEntry(url);
  const result = Object.entries(manifestObject).find(
    ([key, val]) => manifestObject[key] === remoteEntryUrl
  );
  if (!result) throw new Error('unknown remote ' + url);
  const moduleName = result[0];
  return `${moduleName}${new URL(url).pathname}`;
}

import { LoadRemoteModuleOptions } from './load-remote-module';

export async function loadRemoteModuleSsr<T = any>(
  options: LoadRemoteModuleOptions
): Promise<T> {
  const { remoteName, exposedModule } = options;
  if (!remoteName || !manifestObject[remoteName])
    throw new Error('unknown remote ' + remoteName);
  const remoteEntryJson = await getRemoteEntryJson(remoteName);
  if (!remoteEntryJson['exposes'] || !Array.isArray(remoteEntryJson['exposes']))
    throw new Error(
      'remoteEntry for "' + remoteName + '" doesn\'t have "exposes"'
    );

  const exposed = remoteEntryJson['exposes'].find(
    (i) => i.key === exposedModule
  );
  const resultUrl = joinPaths(
    getDirectory(manifestObject[remoteName]),
    exposed.outFileName
  );

  return import(/* @vite-ignore */ resultUrl);
}

async function getRemoteEntryJson(
  remoteName: string
): Promise<Record<string, unknown>> {
  if (remoteEntryJsonMap[remoteName]) return remoteEntryJsonMap[remoteName];
  const remoteEntryJson = await fetch(manifestObject[remoteName]).then((r) =>
    r.json()
  );
  remoteEntryJsonMap[remoteName] = remoteEntryJson;
  return remoteEntryJson;
}
