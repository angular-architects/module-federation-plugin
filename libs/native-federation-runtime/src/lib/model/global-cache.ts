import { Remote } from './remotes';

export const nfNamespace = '__NATIVE_FEDERATION__';

export type NfCache = {
  externals: Map<string, string>;
  remoteNamesToRemote: Map<string, Remote>;
  baseUrlToRemoteNames: Map<string, string>;
};

export type Global = {
  [nfNamespace]: NfCache;
};

const global = globalThis as unknown as Global;

global[nfNamespace] ??= {
  externals: new Map<string, string>(),
  remoteNamesToRemote: new Map<string, Remote>(),
  baseUrlToRemoteNames: new Map<string, string>(),
};

export const globalCache = global[nfNamespace];
