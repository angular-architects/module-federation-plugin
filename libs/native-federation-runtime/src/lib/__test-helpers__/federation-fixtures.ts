import type { FederationInfo } from '../model/federation-info';

/**
 * Test fixture builder for FederationInfo objects
 */
export const createFederationInfo = (
  overrides?: Partial<FederationInfo>
): FederationInfo => ({
  name: 'default-host',
  exposes: [],
  shared: [],
  ...overrides,
});

/**
 * Creates a host federation info with shared dependencies
 */
export const createHostInfo = (name = 'host'): FederationInfo => ({
  name,
  exposes: [],
  shared: [
    {
      singleton: true,
      strictVersion: true,
      requiredVersion: '^18.0.0',
      packageName: 'angular',
      outFileName: 'angular.js',
    },
    {
      singleton: true,
      strictVersion: false,
      requiredVersion: '^18.2.0',
      packageName: 'rxjs',
      outFileName: 'rxjs.js',
    },
  ],
});

/**
 * Creates a remote MFE federation info with exposes and shared
 */
export const createRemoteInfo = (
  name = 'mfe1',
  exposes: Array<{ key: string; outFileName: string }> = []
): FederationInfo => ({
  name,
  exposes: exposes.length > 0 ? exposes : [
    {
      key: './Component',
      outFileName: 'Component.js',
    },
  ],
  shared: [
    {
      singleton: true,
      strictVersion: false,
      requiredVersion: '^4.0.0',
      packageName: 'lodash',
      outFileName: 'lodash.js',
    },
  ],
});

/**
 * Creates a minimal remote info without dependencies
 */
export const createMinimalRemoteInfo = (name = 'minimal-mfe'): FederationInfo => ({
  name,
  exposes: [
    {
      key: './Module',
      outFileName: 'Module.js',
    },
  ],
  shared: [],
});

/**
 * Test URLs constants
 */
export const TEST_URLS = {
  HOST_REMOTE_ENTRY: './remoteEntry.json',
  MFE1_BASE: 'http://localhost:3000/mfe1',
  MFE1_REMOTE_ENTRY: 'http://localhost:3000/mfe1/remoteEntry.json',
  MFE2_BASE: 'http://localhost:4000/mfe2',
  MFE2_REMOTE_ENTRY: 'http://localhost:4000/mfe2/remoteEntry.json',
  INVALID_URL: 'http://invalid-domain-that-does-not-exist.test/remoteEntry.json',
} as const;

/**
 * Creates a remote config object for initFederation
 */
export const createRemoteConfig = (
  ...remotes: Array<{ name: string; url: string }>
): Record<string, string> => {
  return remotes.reduce((acc, { name, url }) => {
    acc[name] = url;
    return acc;
  }, {} as Record<string, string>);
};

