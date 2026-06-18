import { beforeEach, describe, expect, it } from 'vitest';
import { getExternalUrl, setExternalUrl } from './externals';
import { SharedInfo } from './federation-info';
import { globalCache } from './global-cache';

describe('externals', () => {
  const fakeSharedInfo: SharedInfo = {
    singleton: true,
    strictVersion: false,
    requiredVersion: '^15.0.0',
    version: '15.0.0',
    packageName: '@angular/core',
    outFileName: 'angular-core.js',
    dev: {
      entryPoint: '@angular/core',
    },
  };

  const fakeSharedInfoWithoutVersion: SharedInfo = {
    singleton: false,
    strictVersion: true,
    requiredVersion: '^4.0.0',
    packageName: 'lodash',
    outFileName: 'lodash.js',
  };

  beforeEach(() => {
    globalCache.externals.clear();
  });

  describe('setExternalUrl', () => {
    it('stores external URL with correct key format', () => {
      const url = 'http://localhost:4200/angular-core.js';

      setExternalUrl(fakeSharedInfo, url);

      expect(getExternalUrl(fakeSharedInfo)).toBe(url);
    });

    it('handles package without version', () => {
      const url = 'http://localhost:4200/lodash.js';

      setExternalUrl(fakeSharedInfoWithoutVersion, url);

      expect(getExternalUrl(fakeSharedInfoWithoutVersion)).toBe(url);
    });
  });

  describe('singleton dedup', () => {
    it('reuses an existing singleton URL when a remote requests the same package at a different version', () => {
      const hostUrl = 'file:///host/angular-core.js';
      const remoteSingletonOtherVersion: SharedInfo = {
        ...fakeSharedInfo,
        version: '15.2.5',
        outFileName: 'angular-core.remote.js',
      };

      setExternalUrl(fakeSharedInfo, hostUrl);

      // The remote's lookup should hit the host's already-registered singleton
      // instead of treating its own version as a distinct external.
      expect(getExternalUrl(remoteSingletonOtherVersion)).toBe(hostUrl);
    });

    it('keeps distinct entries for non-singletons at different versions', () => {
      const hostUrl = 'file:///host/lodash-v3.js';
      const remoteUrl = 'http://localhost:4201/lodash-v4.js';
      const remoteNonSingletonOtherVersion: SharedInfo = {
        ...fakeSharedInfoWithoutVersion,
        version: '4.17.21',
      };
      const hostNonSingleton: SharedInfo = {
        ...fakeSharedInfoWithoutVersion,
        version: '3.10.1',
      };

      setExternalUrl(hostNonSingleton, hostUrl);
      setExternalUrl(remoteNonSingletonOtherVersion, remoteUrl);

      expect(getExternalUrl(hostNonSingleton)).toBe(hostUrl);
      expect(getExternalUrl(remoteNonSingletonOtherVersion)).toBe(remoteUrl);
    });
  });

  describe('getExternalUrl', () => {
    it('returns stored URL for existing external', () => {
      const url = 'http://localhost:4200/angular-core.js';
      setExternalUrl(fakeSharedInfo, url);

      const retrievedUrl = getExternalUrl(fakeSharedInfo);
      expect(retrievedUrl).toBe(url);
    });

    it('returns undefined for non-existing external', () => {
      const nonExistingSharedInfo: SharedInfo = {
        singleton: false,
        strictVersion: false,
        requiredVersion: '^1.0.0',
        version: '1.0.0',
        packageName: 'non-existing-package',
        outFileName: 'non-existing.js',
      };

      const retrievedUrl = getExternalUrl(nonExistingSharedInfo);
      expect(retrievedUrl).toBeUndefined();
    });
  });
});
