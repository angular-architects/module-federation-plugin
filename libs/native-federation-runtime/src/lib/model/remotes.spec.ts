import { beforeEach, describe, expect, it } from 'vitest';
import { globalCache } from './global-cache';
import {
  addRemote,
  getRemote,
  getRemoteNameByBaseUrl,
  hasRemote,
  isRemoteInitialized,
  Remote,
} from './remotes';

describe('remotes', () => {
  const fakeRemote: Remote = {
    name: 'shell-app',
    baseUrl: 'http://localhost:4200',
    exposes: [
      {
        key: './Component',
        outFileName: 'component.js',
      },
    ],
    shared: [
      {
        singleton: true,
        strictVersion: false,
        requiredVersion: '^15.0.0',
        version: '15.0.0',
        packageName: '@angular/core',
        outFileName: 'angular-core.js',
      },
    ],
  };

  beforeEach(() => {
    globalCache.remoteNamesToRemote.clear();
    globalCache.baseUrlToRemoteNames.clear();
  });

  describe('addRemote', () => {
    it('stores remote and creates bidirectional mapping', () => {
      addRemote('shell-app', fakeRemote);

      expect(getRemote('shell-app')).toEqual(fakeRemote);
      expect(getRemoteNameByBaseUrl('http://localhost:4200')).toBe('shell-app');
    });
  });

  describe('getRemoteNameByBaseUrl', () => {
    it('returns remote name for existing baseUrl', () => {
      addRemote('shell-app', fakeRemote);

      const remoteName = getRemoteNameByBaseUrl('http://localhost:4200');
      expect(remoteName).toBe('shell-app');
    });

    it('returns undefined for non-existing baseUrl', () => {
      const remoteName = getRemoteNameByBaseUrl('http://localhost:9999');
      expect(remoteName).toBeUndefined();
    });
  });

  describe('isRemoteInitialized', () => {
    it('returns true for initialized remote', () => {
      addRemote('shell-app', fakeRemote);

      expect(isRemoteInitialized('http://localhost:4200')).toBe(true);
    });

    it('returns false for non-initialized remote', () => {
      expect(isRemoteInitialized('http://localhost:9999')).toBe(false);
    });
  });

  describe('getRemote', () => {
    it('returns stored remote for existing name', () => {
      addRemote('shell-app', fakeRemote);

      const remote = getRemote('shell-app');
      expect(remote).toEqual(fakeRemote);
    });

    it('returns undefined for non-existing remote name', () => {
      const remote = getRemote('non-existing-remote');
      expect(remote).toBeUndefined();
    });
  });

  describe('hasRemote', () => {
    it('returns true for existing remote', () => {
      addRemote('shell-app', fakeRemote);

      expect(hasRemote('shell-app')).toBe(true);
    });

    it('returns false for non-existing remote', () => {
      expect(hasRemote('non-existing-remote')).toBe(false);
    });
  });
});
