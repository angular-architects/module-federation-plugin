import { processRemoteShared } from './process-remote-shared';
import { getHostInfoOrThrow } from './init-federation-cache';
import { FederationInfo, SharedInfo } from './model/federation-info';
import { Imports } from './model/import-map';

// Mock the getHostInfoOrThrow function
jest.mock('./init-federation-cache', () => ({
  getHostInfoOrThrow: jest.fn(),
}));

const mockGetHostInfoOrThrow = getHostInfoOrThrow as jest.MockedFunction<
  typeof getHostInfoOrThrow
>;

describe('processRemoteShared', () => {
  const hostFederationInfo: FederationInfo = {
    name: 'host',
    exposes: [],
    shared: [
      {
        packageName: '@angular/core',
        singleton: true,
        requiredVersion: '^18.0.0',
        version: '18.0.0',
        outFileName: 'angular-core.js',
        strictVersion: true,
      },
    ],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockGetHostInfoOrThrow.mockReturnValue(hostFederationInfo);
  });

  it('should use host version when remote requires singleton and versions are compatible', () => {
    const scope: Imports = {};
    const remoteShared: SharedInfo = {
      packageName: '@angular/core',
      singleton: true,
      requiredVersion: '^18.0.0',
      version: '18.1.0',
      outFileName: 'angular-core.js',
      strictVersion: true,
    };

    processRemoteShared(scope, remoteShared);

    expect(scope['@angular/core']).toBe('./angular-core.js');
  });

  it('should throw error when remote requires singleton and versions are incompatible', () => {
    const scope: Imports = {};
    const remoteShared: SharedInfo = {
      packageName: '@angular/core',
      singleton: true,
      requiredVersion: '^19.0.0',
      version: '19.0.0',
      outFileName: 'angular-core.js',
      strictVersion: true,
    };

    expect(() => {
      processRemoteShared(scope, remoteShared);
    }).toThrowError(
      'Host has version 18.0.0 of @angular/core but remote requires ^19.0.0 and we are in singleton mode'
    );
  });

  it('should do nothing when remote requires singleton and host does not share the module', () => {
    mockGetHostInfoOrThrow.mockReturnValue({
      name: 'host',
      exposes: [],
      shared: [],
    });

    const scope: Imports = {};
    const remoteShared: SharedInfo = {
      packageName: '@angular/core',
      singleton: true,
      requiredVersion: '^18.0.0',
      version: '18.0.0',
      outFileName: 'angular-core.js',
      strictVersion: true,
    };

    processRemoteShared(scope, remoteShared);

    expect(scope).toEqual({});
  });

  it('should use host version when remote does not require singleton and versions are compatible', () => {
    const scope: Imports = {};
    const remoteShared: SharedInfo = {
      packageName: '@angular/core',
      singleton: false,
      requiredVersion: '^18.0.0',
      version: '18.1.0',
      outFileName: 'angular-core.js',
      strictVersion: true,
    };

    processRemoteShared(scope, remoteShared);

    expect(scope['@angular/core']).toBe('./angular-core.js');
  });

  it('should not use host version when remote does not require singleton and versions are incompatible', () => {
    const scope: Imports = {};
    const remoteShared: SharedInfo = {
      packageName: '@angular/core',
      singleton: false,
      requiredVersion: '^19.0.0',
      version: '19.0.0',
      outFileName: 'angular-core.js',
      strictVersion: true,
    };

    processRemoteShared(scope, remoteShared);

    expect(scope).toEqual({});
  });

  it('should do nothing when remote does not require singleton and host does not share the module', () => {
    mockGetHostInfoOrThrow.mockReturnValue({
      name: 'host',
      exposes: [],
      shared: [],
    });

    const scope: Imports = {};
    const remoteShared: SharedInfo = {
      packageName: '@angular/core',
      singleton: false,
      requiredVersion: '^18.0.0',
      version: '18.0.0',
      outFileName: 'angular-core.js',
      strictVersion: true,
    };

    processRemoteShared(scope, remoteShared);

    expect(scope).toEqual({});
  });

  it('should use host version when singleton is true and neither host nor remote have version info', () => {
    const hostSharedWithoutVersion: SharedInfo = {
      packageName: '@angular/core',
      singleton: true,
      requiredVersion: '',
      version: '',
      outFileName: 'angular-core.js',
      strictVersion: true,
    };

    mockGetHostInfoOrThrow.mockReturnValue({
      name: 'host',
      exposes: [],
      shared: [hostSharedWithoutVersion],
    });

    const scope: Imports = {};
    const remoteShared: SharedInfo = {
      packageName: '@angular/core',
      singleton: true,
      requiredVersion: '',
      version: '',
      outFileName: 'angular-core.js',
      strictVersion: true,
    };

    processRemoteShared(scope, remoteShared);

    expect(scope['@angular/core']).toBe('./angular-core.js');
  });

  it('should use host version when singleton is false and neither host nor remote have version info', () => {
    const hostSharedWithoutVersion: SharedInfo = {
      packageName: '@angular/core',
      singleton: false,
      requiredVersion: '',
      version: '',
      outFileName: 'angular-core.js',
      strictVersion: true,
    };

    mockGetHostInfoOrThrow.mockReturnValue({
      name: 'host',
      exposes: [],
      shared: [hostSharedWithoutVersion],
    });

    const scope: Imports = {};
    const remoteShared: SharedInfo = {
      packageName: '@angular/core',
      singleton: false,
      requiredVersion: '',
      version: '',
      outFileName: 'angular-core.js',
      strictVersion: true,
    };

    processRemoteShared(scope, remoteShared);

    expect(scope['@angular/core']).toBe('./angular-core.js');
  });

  it('should use custom relative host bundle path when provided', () => {
    const scope: Imports = {};
    const remoteShared: SharedInfo = {
      packageName: '@angular/core',
      singleton: true,
      requiredVersion: '^18.0.0',
      version: '18.1.0',
      outFileName: 'angular-core.js',
      strictVersion: true,
    };

    const relHostBundlesPath = '../bundles/';

    processRemoteShared(scope, remoteShared, relHostBundlesPath);

    expect(scope['@angular/core']).toBe('../bundles/angular-core.js');
  });
});
