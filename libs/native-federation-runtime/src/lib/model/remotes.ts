import { globalCache } from './global-cache';

const baseUrlToRemoteNames = globalCache.baseUrlToRemoteNames;

export function getRemoteNameByBaseUrl(baseUrl: string): string | undefined {
  return baseUrlToRemoteNames.get(baseUrl);
}

export function isRemoteInitialized(baseUrl: string): boolean {
  return baseUrlToRemoteNames.has(baseUrl);
}
