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
