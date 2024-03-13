export const nfNamespace = '__NATIVE_FEDERATION__';

export type NfCache = {
  externals: Map<string, string>;
  baseUrlToRemoteNames: Map<string, string>;
};

export type Global = {
  [nfNamespace]: NfCache;
};

const global = globalThis as unknown as Global;

global[nfNamespace] ??= {
  externals: new Map<string, string>(),
  baseUrlToRemoteNames: new Map<string, string>(),
};

export const globalCache = global[nfNamespace];
