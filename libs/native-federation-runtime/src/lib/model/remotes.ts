import { FederationInfo } from './federation-info';
import { globalCache } from './global-cache';

export type Remote = FederationInfo & {
  baseUrl: string;
};

const remoteNamesToRemote = globalCache.remoteNamesToRemote;
const baseUrlToRemoteNames = globalCache.baseUrlToRemoteNames;

export function addRemote(remoteName: string, remote: Remote): void {
  remoteNamesToRemote.set(remoteName, remote);
  baseUrlToRemoteNames.set(remote.baseUrl, remoteName);
}

export function getRemoteNameByBaseUrl(baseUrl: string): string | undefined {
  return baseUrlToRemoteNames.get(baseUrl);
}

export function isRemoteInitialized(baseUrl: string): boolean {
  return baseUrlToRemoteNames.has(baseUrl);
}

export function getRemote(remoteName: string): Remote | undefined {
  return remoteNamesToRemote.get(remoteName);
}

export function hasRemote(remoteName: string): boolean {
  return remoteNamesToRemote.has(remoteName);
}
