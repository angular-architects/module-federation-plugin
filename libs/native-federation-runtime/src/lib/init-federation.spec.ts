/* eslint-disable @typescript-eslint/ban-ts-comment */
import { initFederation, processRemoteInfo } from './init-federation';
import { FederationInfo } from './model/federation-info';
import { globalCache } from './model/global-cache';

// GIVEN
const mfAdminRemoteEntry: FederationInfo = {
  name: 'mfAdmin',
  shared: [
    {
      packageName: '@angular/animations',
      outFileName: '_angular_animations-17_1_3-dev.js',
      requiredVersion: '~17.1.0',
      singleton: true,
      strictVersion: true,
      version: '17.1.3',
    },
  ],
  exposes: [
    {
      key: 'MyAdminComponent',
      outFileName: 'my-admin-component.js',
    },
  ],
};

// GIVEN
const mfHomeRemoteEntry: FederationInfo = {
  name: 'mfHome',
  shared: [
    {
      packageName: '@angular/animations',
      outFileName: '_angular_animations-17_1_3-dev.js',
      requiredVersion: '~17.1.0',
      singleton: true,
      strictVersion: true,
      version: '17.1.3',
    },
  ],
  exposes: [
    {
      key: 'MyHomeComponent',
      outFileName: 'my-home-component.js',
    },
  ],
};

describe('Initialize Native Federation', () => {
  beforeEach(() => {
    // Mock fetch method when load the remoteEntry.json
    // @ts-ignore
    global.fetch = jest.fn((args) =>
      Promise.resolve({
        json: () =>
          Promise.resolve(
            args.toString().includes('mfAdmin')
              ? mfAdminRemoteEntry
              : mfHomeRemoteEntry
          ),
      })
    );

    // Be sure there is not external left between tests
    globalCache.externals.clear();

    // Mock es-module-shims
    // @ts-ignore
    global.importShim = {
      addImportMap: jest.fn(),
      getImportMap: jest.fn(),
    };
  });

  describe('initFederation', () => {
    it('init multiple remotes', async () => {
      // GIVEN
      // Mock es-module-shims
      // @ts-ignore
      global.importShim = {
        addImportMap: jest.fn(),
        getImportMap: jest.fn(() => ({
          imports: {
            '@angular/animations':
              'http://localhost/_angular_animations-17_1_3-dev.js',
          },
          scopes: {},
        })),
      };

      // TEST
      const importMap = await initFederation({
        mfAdmin: 'http://localhost/mfAdmin/remoteEntry.json',
        mfHome: 'http://localhost/mfHome/remoteEntry.json',
      });

      // EXPECT
      expect(importMap).toEqual({
        imports: {
          'mfAdmin/MyAdminComponent':
            'http://localhost/mfAdmin/my-admin-component.js',
          'mfHome/MyHomeComponent':
            'http://localhost/mfHome/my-home-component.js',
        },
        scopes: {},
      });
      expect(importShim.getImportMap).toHaveBeenCalledTimes(2);
      expect(importShim.addImportMap).toHaveBeenNthCalledWith(1, {
        imports: {
          'mfAdmin/MyAdminComponent':
            'http://localhost/mfAdmin/my-admin-component.js',
        },
        scopes: {},
      });
      expect(importShim.addImportMap).toHaveBeenNthCalledWith(2, {
        imports: {
          'mfHome/MyHomeComponent':
            'http://localhost/mfHome/my-home-component.js',
        },
        scopes: {},
      });
    });
  });

  describe('processRemoteInfo', () => {
    it('Should return valid importmap from a remoteEntry', async () => {
      // TEST
      const importMap = await processRemoteInfo(
        'http://localhost/mfAdmin/remoteEntry.json'
      );

      // EXPECT
      expect(importMap).toEqual({
        imports: {
          'mfAdmin/MyAdminComponent':
            'http://localhost/mfAdmin/my-admin-component.js',
        },
        scopes: {
          'http://localhost/mfAdmin/': {
            '@angular/animations':
              'http://localhost/mfAdmin/_angular_animations-17_1_3-dev.js',
          },
        },
      });
      expect(importShim.getImportMap).toHaveBeenCalledTimes(1);
      expect(importShim.addImportMap).toHaveBeenCalledWith(importMap);
    });

    it('Should reuse default mapping if host has same version', async () => {
      // GIVEN
      // Mock es-module-shims
      // @ts-ignore
      global.importShim = {
        addImportMap: jest.fn(),
        getImportMap: jest.fn(() => ({
          imports: {
            '@angular/animations':
              'http://localhost/_angular_animations-17_1_3-dev.js',
          },
          scopes: {},
        })),
      };

      // TEST
      const importMap = await processRemoteInfo(
        'http://localhost/mfAdmin/remoteEntry.json'
      );

      // EXPECT
      expect(importMap).toEqual({
        imports: {
          'mfAdmin/MyAdminComponent':
            'http://localhost/mfAdmin/my-admin-component.js',
        },
        scopes: {},
      });
      expect(importShim.getImportMap).toHaveBeenCalledTimes(1);
      expect(importShim.addImportMap).toHaveBeenCalledWith(importMap);
    });

    it('Should reuse another mf mapping if shared library has same version', async () => {
      // First call to create externals for mfAdmin
      expect(
        await processRemoteInfo('http://localhost/mfAdmin/remoteEntry.json')
      ).toEqual({
        imports: {
          'mfAdmin/MyAdminComponent':
            'http://localhost/mfAdmin/my-admin-component.js',
        },
        scopes: {
          'http://localhost/mfAdmin/': {
            '@angular/animations':
              'http://localhost/mfAdmin/_angular_animations-17_1_3-dev.js',
          },
        },
      });

      // Second call, @angular/animations already declared by mfAdmin so it reuse it
      expect(
        await processRemoteInfo('http://localhost/mfHome/remoteEntry.json')
      ).toEqual({
        imports: {
          'mfHome/MyHomeComponent':
            'http://localhost/mfHome/my-home-component.js',
        },
        scopes: {
          'http://localhost/mfHome/': {
            '@angular/animations':
              'http://localhost/mfAdmin/_angular_animations-17_1_3-dev.js',
          },
        },
      });
    });

    it('Should specify another scope if shared library has different version', async () => {
      expect(
        await processRemoteInfo('http://localhost/mfAdmin/remoteEntry.json')
      ).toEqual({
        imports: {
          'mfAdmin/MyAdminComponent':
            'http://localhost/mfAdmin/my-admin-component.js',
        },
        scopes: {
          'http://localhost/mfAdmin/': {
            '@angular/animations':
              'http://localhost/mfAdmin/_angular_animations-17_1_3-dev.js',
          },
        },
      });

      // set another version for mfHome
      mfHomeRemoteEntry.shared[0] = {
        ...mfHomeRemoteEntry.shared[0],
        outFileName: '_angular_animations-17_2_0-dev.js',
        version: '17.2.0',
      };

      // Second call, @angular/animations already declared by mfAdmin but it is not the same version, so it declares a scope with it
      expect(
        await processRemoteInfo('http://localhost/mfHome/remoteEntry.json')
      ).toEqual({
        imports: {
          'mfHome/MyHomeComponent':
            'http://localhost/mfHome/my-home-component.js',
        },
        scopes: {
          'http://localhost/mfHome/': {
            '@angular/animations':
              'http://localhost/mfHome/_angular_animations-17_2_0-dev.js',
          },
        },
      });
    });
  });
});
