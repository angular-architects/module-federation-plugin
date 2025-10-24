import { SharedInfo } from './federation-info';
import { globalCache } from './global-cache';

const externals = globalCache.externals;

function getExternalKey(shared: SharedInfo) {
  return `${shared.packageName}@${shared.version}`;
}

export function getExternalUrl(shared: SharedInfo): string | undefined {
  const packageKey = getExternalKey(shared);
  return externals.get(packageKey);
}

export function setExternalUrl(shared: SharedInfo, url: string): void {
  const packageKey = getExternalKey(shared);
  externals.set(packageKey, url);
}
