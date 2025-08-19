import { SharedInfo } from './federation-info';
import { globalCache } from './global-cache';

const externals = globalCache.externals;
const externalsByScope = globalCache.externalsByScope;

function getExternalKey(shared: SharedInfo) {
  return `${shared.packageName}@${shared.version}`;
}

export function getExternalUrl(shared: SharedInfo): string | undefined {
  const packageKey = getExternalKey(shared);
  if (
    shared.shareScope &&
    externalsByScope.get(shared.shareScope)?.has(packageKey)
  ) {
    return externalsByScope.get(shared.shareScope)?.get(packageKey);
  }
  return externals.get(packageKey);
}

export function setExternalUrl(shared: SharedInfo, url: string): void {
  const packageKey = getExternalKey(shared);
  if (shared.shareScope) {
    if (!externalsByScope.has(shared.shareScope)) {
      externalsByScope.set(shared.shareScope, new Map<string, string>());
    }
    externalsByScope.get(shared.shareScope)?.set(packageKey, url);
  }
  externals.set(packageKey, url);
}
