import { FederationInfo } from './model/federation-info';

let _hostInfo: FederationInfo | undefined = undefined;

/**
 * Keeps in cache the last host info loaded
 * @param hostInfo
 */
export function setHostInfo(hostInfo: FederationInfo) {
  _hostInfo = hostInfo;
}

/**
 * Returns the last host info loaded
 */
export function getHostInfo(): FederationInfo | undefined {
  return _hostInfo;
}

/**
 * Returns the last host info loaded or throws an error if not loaded
 */
export function getHostInfoOrThrow(): FederationInfo {
  if (!_hostInfo) throw new Error('Host info not loaded');
  return _hostInfo;
}
