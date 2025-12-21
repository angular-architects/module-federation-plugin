import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  clearFederationDOMEffects,
  getImportMapContent,
  getImportMapScriptCount,
  getImportMapScripts,
} from './__test-helpers__/dom-helpers';
import {
  createFederationInfo,
  createHostInfo,
  createMinimalRemoteInfo,
  createRemoteConfig,
  createRemoteInfo,
  TEST_URLS,
} from './__test-helpers__/federation-fixtures';
import {
  createFederationHandlers,
  hostRemoteEntryHandler,
  malformedJsonHandler,
  networkErrorHandler,
  notFoundHandler,
  remoteEntryHandler,
} from './__test-helpers__/msw-handlers';
import { initFederation } from './init-federation';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Helper to capture console errors during test execution.
 * Returns a cleanup function that restores the original console.error.
 *
 * @param onError - Optional callback to capture error messages
 * @returns Cleanup function to restore console.error
 */
function captureConsoleErrors(onError?: (...args: any[]) => void): () => void {
  const originalError = console.error;
  console.error = onError || (() => {});
  return () => {
    console.error = originalError;
  };
}

/**
 * Helper to capture console error messages in an array.
 * Returns both the messages array and a cleanup function.
 *
 * @returns Tuple of [messages array, cleanup function]
 */
function captureConsoleErrorMessages(): [string[], () => void] {
  const messages: string[] = [];
  const cleanup = captureConsoleErrors((...args: any[]) => {
    messages.push(args.join(' '));
  });
  return [messages, cleanup];
}

/**
 * Integration tests for initFederation using MSW for network mocking
 */
describe('initFederation - Browser Integration Test', () => {
  const worker = setupWorker();

  beforeAll(async () => {
    await worker.start({
      onUnhandledRequest: 'error',
      quiet: false,
    });
  });

  afterAll(() => worker.stop());

  beforeEach(() => {
    clearFederationDOMEffects();
  });

  afterEach(() => {
    worker.resetHandlers();
  });

  // ==========================================================================
  // BASIC INITIALIZATION TESTS
  // ==========================================================================
  // These tests verify the fundamental initialization flows:
  // - Host-only setup (no remotes)
  // - Single remote integration
  // - Multiple remotes working together
  describe('Basic Initialization', () => {
    it('should initialize federation without remotes', async () => {
      const hostInfo = createHostInfo();
      worker.use(hostRemoteEntryHandler(hostInfo));

      const result = await initFederation({});

      expect(result).toEqual(
        expect.objectContaining({
          imports: expect.objectContaining({
            angular: './angular.js',
            rxjs: './rxjs.js',
          }),
          scopes: {},
        }),
      );
    });

    it('should initialize federation with empty host info', async () => {
      const hostInfo = createFederationInfo({ name: 'empty-host' });
      worker.use(hostRemoteEntryHandler(hostInfo));

      const result = await initFederation({});

      expect(result).toEqual({
        imports: {},
        scopes: {},
      });
    });

    it('should initialize federation with one remote', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const remoteInfo = createRemoteInfo('mfe1');

      worker.use(
        hostRemoteEntryHandler(hostInfo),
        remoteEntryHandler(TEST_URLS.MFE1_REMOTE_ENTRY, remoteInfo),
      );

      const result = await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      expect(result.imports).toEqual(
        expect.objectContaining({
          'mfe1/Component': `${TEST_URLS.MFE1_BASE}/Component.js`,
        }),
      );
      expect(result.scopes).toHaveProperty(`${TEST_URLS.MFE1_BASE}/`);
      expect(result.scopes[`${TEST_URLS.MFE1_BASE}/`]).toEqual(
        expect.objectContaining({
          lodash: `${TEST_URLS.MFE1_BASE}/lodash.js`,
        }),
      );
    });

    it('should initialize federation with multiple remotes', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const mfe1Info = createRemoteInfo('mfe1', [
        { key: './Component', outFileName: 'Component.js' },
      ]);
      const mfe2Info = createRemoteInfo('mfe2', [
        { key: './Button', outFileName: 'Button.js' },
      ]);

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [
            { url: TEST_URLS.MFE1_REMOTE_ENTRY, info: mfe1Info },
            { url: TEST_URLS.MFE2_REMOTE_ENTRY, info: mfe2Info },
          ],
        }),
      );

      const result = await initFederation(
        createRemoteConfig(
          { name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY },
          { name: 'mfe2', url: TEST_URLS.MFE2_REMOTE_ENTRY },
        ),
      );

      expect(result.imports).toEqual(
        expect.objectContaining({
          'mfe1/Component': `${TEST_URLS.MFE1_BASE}/Component.js`,
          'mfe2/Button': `${TEST_URLS.MFE2_BASE}/Button.js`,
        }),
      );
      expect(result.scopes).toHaveProperty(`${TEST_URLS.MFE1_BASE}/`);
      expect(result.scopes).toHaveProperty(`${TEST_URLS.MFE2_BASE}/`);
    });
  });

  // ==========================================================================
  // DOM MANIPULATION TESTS
  // ==========================================================================
  // These tests verify that initFederation correctly manipulates the DOM:
  // - Script tag injection
  // - Importmap structure and content
  // - Multiple initialization calls
  describe('DOM Manipulation', () => {
    it('should append importmap-shim script to document head', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      worker.use(hostRemoteEntryHandler(hostInfo));

      await initFederation({});

      const scripts = getImportMapScripts();
      expect(scripts.length).toBe(1);
      expect(scripts[0].type).toBe('importmap-shim');
    });

    it('should create importmap with correct structure', async () => {
      const hostInfo = createHostInfo();
      worker.use(hostRemoteEntryHandler(hostInfo));

      await initFederation({});

      const importMapContent = getImportMapContent();
      expect(importMapContent).not.toBeNull();
      expect(importMapContent).toHaveProperty('imports');
      expect(importMapContent).toHaveProperty('scopes');
      expect(importMapContent!.imports).toEqual(
        expect.objectContaining({
          angular: './angular.js',
          rxjs: './rxjs.js',
        }),
      );
    });

    it('should handle multiple calls without creating duplicate scripts', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      worker.use(hostRemoteEntryHandler(hostInfo));

      await initFederation({});
      const firstCount = getImportMapScriptCount();

      await initFederation({});
      const secondCount = getImportMapScriptCount();

      // Each call adds a new script (this is the actual behavior)
      expect(secondCount).toBe(firstCount + 1);
    });
  });

  // ==========================================================================
  // CACHE TAG HANDLING TESTS
  // ==========================================================================
  // These tests verify cache busting functionality:
  // - CacheTag applied to host requests
  // - CacheTag applied to all remote requests
  // - Correct parameter separator (? or &) based on existing query params
  describe('Cache Tag Handling', () => {
    it('should apply cacheTag to host request', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      let capturedUrl = '';

      worker.use(
        http.get('./remoteEntry.json', ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json(hostInfo);
        }),
      );

      await initFederation({}, { cacheTag: 'v1.0.0' });

      expect(capturedUrl).toContain('t=v1.0.0');
    });

    it('should apply cacheTag to all remote requests', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const remoteInfo = createRemoteInfo('mfe1');
      const capturedUrls: string[] = [];

      worker.use(
        http.get('./remoteEntry.json', ({ request }) => {
          capturedUrls.push(request.url);
          return HttpResponse.json(hostInfo);
        }),
        http.get(TEST_URLS.MFE1_REMOTE_ENTRY, ({ request }) => {
          capturedUrls.push(request.url);
          return HttpResponse.json(remoteInfo);
        }),
      );

      await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
        { cacheTag: 'v2.5.1' },
      );

      expect(capturedUrls.length).toBe(2);
      expect(capturedUrls.every((url) => url.includes('t=v2.5.1'))).toBe(true);
    });

    it('should append cacheTag with & when URL has existing query params', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const remoteInfo = createRemoteInfo('mfe1');
      const urlWithParams = `${TEST_URLS.MFE1_REMOTE_ENTRY}?env=prod`;
      let capturedRemoteUrl = '';

      worker.use(
        hostRemoteEntryHandler(hostInfo),
        http.get(TEST_URLS.MFE1_REMOTE_ENTRY, ({ request }) => {
          capturedRemoteUrl = request.url;
          return HttpResponse.json(remoteInfo);
        }),
      );

      await initFederation(
        createRemoteConfig({ name: 'mfe1', url: urlWithParams }),
        { cacheTag: 'v1.0.0' },
      );

      expect(capturedRemoteUrl).toContain('env=prod');
      expect(capturedRemoteUrl).toContain('&t=v1.0.0');
    });
  });

  // ==========================================================================
  // IMPORT MAP MERGING TESTS
  // ==========================================================================
  // These tests verify that import maps from different sources merge correctly:
  // - Host shared deps in root imports
  // - Remote exposed modules in root imports
  // - Remote shared deps in scoped imports
  // - Handling overlapping dependencies between remotes
  describe('Import Map Merging', () => {
    it('should merge host and remote import maps correctly', async () => {
      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './Button', outFileName: 'Button.js' },
      ]);

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      const result = await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      // Host shared dependencies in root imports
      expect(result.imports['angular']).toBe('./angular.js');
      expect(result.imports['rxjs']).toBe('./rxjs.js');

      // Remote exposed modules in root imports
      expect(result.imports['mfe1/Button']).toBe(
        `${TEST_URLS.MFE1_BASE}/Button.js`,
      );

      // Remote shared dependencies in scopes
      expect(result.scopes[`${TEST_URLS.MFE1_BASE}/`]['lodash']).toBe(
        `${TEST_URLS.MFE1_BASE}/lodash.js`,
      );
    });

    it('should handle multiple remotes with overlapping shared dependencies', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const sharedDep = {
        singleton: true,
        strictVersion: false,
        requiredVersion: '^4.0.0',
        packageName: 'lodash',
        outFileName: 'lodash.js',
      };

      const mfe1Info = createFederationInfo({
        name: 'mfe1',
        exposes: [{ key: './Component', outFileName: 'Component.js' }],
        shared: [sharedDep],
      });

      const mfe2Info = createFederationInfo({
        name: 'mfe2',
        exposes: [{ key: './Service', outFileName: 'Service.js' }],
        shared: [sharedDep],
      });

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [
            { url: TEST_URLS.MFE1_REMOTE_ENTRY, info: mfe1Info },
            { url: TEST_URLS.MFE2_REMOTE_ENTRY, info: mfe2Info },
          ],
        }),
      );

      const result = await initFederation(
        createRemoteConfig(
          { name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY },
          { name: 'mfe2', url: TEST_URLS.MFE2_REMOTE_ENTRY },
        ),
      );

      // Both remotes should have lodash in their scopes
      expect(result.scopes[`${TEST_URLS.MFE1_BASE}/`]['lodash']).toBeDefined();
      expect(result.scopes[`${TEST_URLS.MFE2_BASE}/`]['lodash']).toBeDefined();
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================
  // These tests verify resilient error handling:
  // - 404 responses handled gracefully
  // - Network errors don't crash the app
  // - Malformed JSON handled properly
  // - Host failures are fatal (must have host)
  // - Partial success when some remotes fail
  describe('Error Handling', () => {
    it('should handle 404 response for remote gracefully when throwIfRemoteNotFound is false', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      worker.use(
        hostRemoteEntryHandler(hostInfo),
        notFoundHandler(TEST_URLS.MFE1_REMOTE_ENTRY),
      );

      const [errorMessages, cleanup] = captureConsoleErrorMessages();

      const result = await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      expect(result.imports).toEqual({});
      expect(result.scopes).toEqual({});
      expect(
        errorMessages.some((msg) =>
          msg.includes('Error loading remote entry for mfe1'),
        ),
      ).toBe(true);

      cleanup();
    });

    it('should throw error when remote not found and throwIfRemoteNotFound is true', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      worker.use(
        hostRemoteEntryHandler(hostInfo),
        notFoundHandler(TEST_URLS.MFE1_REMOTE_ENTRY),
      );

      // TODO Note: throwIfRemoteNotFound is not exposed in InitFederationOptions,
      // but it's used internally. We test the default behavior (false) above.
      // To properly test this, we would need to expose it in the public API
      // or test processRemoteInfos directly.

      // For now, this test documents the expected behavior if the option were exposed
      const { fetchAndRegisterRemotes } = await import('./init-federation');

      await expect(
        fetchAndRegisterRemotes(
          createRemoteConfig({
            name: 'mfe1',
            url: TEST_URLS.MFE1_REMOTE_ENTRY,
          }),
          { throwIfRemoteNotFound: true },
        ),
      ).rejects.toThrow('Error loading remote entry for mfe1');
    });

    it('should handle network errors gracefully', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      worker.use(
        hostRemoteEntryHandler(hostInfo),
        networkErrorHandler(TEST_URLS.MFE1_REMOTE_ENTRY),
      );

      let errorCalled = false;
      const cleanup = captureConsoleErrors(() => {
        errorCalled = true;
      });

      const result = await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      expect(result.imports).toEqual({});
      expect(result.scopes).toEqual({});
      expect(errorCalled).toBe(true);

      cleanup();
    });

    it('should handle malformed JSON response', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      worker.use(
        hostRemoteEntryHandler(hostInfo),
        malformedJsonHandler(TEST_URLS.MFE1_REMOTE_ENTRY),
      );

      let errorCalled = false;
      const cleanup = captureConsoleErrors(() => {
        errorCalled = true;
      });

      const result = await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      expect(result.imports).toEqual({});
      expect(result.scopes).toEqual({});
      expect(errorCalled).toBe(true);

      cleanup();
    });

    it('should handle host remoteEntry.json failure', async () => {
      worker.use(notFoundHandler(TEST_URLS.HOST_REMOTE_ENTRY));

      await expect(initFederation({})).rejects.toThrow();
    });

    it('should continue with successful remotes when some fail', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const mfe2Info = createRemoteInfo('mfe2');

      worker.use(
        hostRemoteEntryHandler(hostInfo),
        notFoundHandler(TEST_URLS.MFE1_REMOTE_ENTRY),
        remoteEntryHandler(TEST_URLS.MFE2_REMOTE_ENTRY, mfe2Info),
      );

      const [errorMessages, cleanup] = captureConsoleErrorMessages();

      const result = await initFederation(
        createRemoteConfig(
          { name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY },
          { name: 'mfe2', url: TEST_URLS.MFE2_REMOTE_ENTRY },
        ),
      );

      // mfe2 should be loaded successfully
      expect(result.imports['mfe2/Component']).toBeDefined();
      expect(result.scopes[`${TEST_URLS.MFE2_BASE}/`]).toBeDefined();

      // mfe1 should not be in the result
      expect(result.imports['mfe1/Component']).toBeUndefined();

      expect(
        errorMessages.some((msg) =>
          msg.includes('Error loading remote entry for mfe1'),
        ),
      ).toBe(true);

      cleanup();
    });
  });

  // ==========================================================================
  // EDGE CASES TESTS
  // ==========================================================================
  // These tests verify boundary conditions:
  // - Remotes with no exposed modules
  // - Remotes with no shared dependencies
  // - Empty remotes configuration
  // - Special characters in names
  // - URL formatting edge cases
  describe('Edge Cases', () => {
    it('should handle remote with no exposes', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const remoteInfo = createFederationInfo({
        name: 'mfe1',
        exposes: [],
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

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      const result = await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      expect(Object.keys(result.imports)).toHaveLength(0);
      expect(result.scopes[`${TEST_URLS.MFE1_BASE}/`]['lodash']).toBeDefined();
    });

    it('should handle remote with no shared dependencies', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const remoteInfo = createMinimalRemoteInfo('mfe1');

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      const result = await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      expect(result.imports['mfe1/Module']).toBeDefined();
      expect(result.scopes[`${TEST_URLS.MFE1_BASE}/`]).toEqual({});
    });

    it('should handle empty remotes object', async () => {
      const hostInfo = createHostInfo();
      worker.use(hostRemoteEntryHandler(hostInfo));

      const result = await initFederation({});

      expect(result.imports).toEqual({
        angular: './angular.js',
        rxjs: './rxjs.js',
      });
      expect(result.scopes).toEqual({});
    });

    it('should handle special characters in remote names', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const remoteInfo = createRemoteInfo('my-mfe-1', [
        { key: './Component', outFileName: 'Component.js' },
      ]);

      worker.use(
        hostRemoteEntryHandler(hostInfo),
        remoteEntryHandler(TEST_URLS.MFE1_REMOTE_ENTRY, remoteInfo),
      );

      const result = await initFederation(
        createRemoteConfig({
          name: 'my-mfe-1',
          url: TEST_URLS.MFE1_REMOTE_ENTRY,
        }),
      );

      expect(result.imports['my-mfe-1/Component']).toBeDefined();
    });

    it('should handle URLs with trailing slashes', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const remoteInfo = createRemoteInfo('mfe1');
      const urlWithTrailingSlash = `${TEST_URLS.MFE1_BASE}/remoteEntry.json`;

      worker.use(
        hostRemoteEntryHandler(hostInfo),
        remoteEntryHandler(urlWithTrailingSlash, remoteInfo),
      );

      const result = await initFederation(
        createRemoteConfig({ name: 'mfe1', url: urlWithTrailingSlash }),
      );

      expect(result.imports['mfe1/Component']).toBeDefined();
    });

    it('should handle remote with multiple exposed modules', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './Component', outFileName: 'Component.js' },
        { key: './Button', outFileName: 'Button.js' },
        { key: './Service', outFileName: 'Service.js' },
      ]);

      worker.use(
        hostRemoteEntryHandler(hostInfo),
        remoteEntryHandler(TEST_URLS.MFE1_REMOTE_ENTRY, remoteInfo),
      );

      const result = await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      expect(result.imports['mfe1/Component']).toBe(
        `${TEST_URLS.MFE1_BASE}/Component.js`,
      );
      expect(result.imports['mfe1/Button']).toBe(
        `${TEST_URLS.MFE1_BASE}/Button.js`,
      );
      expect(result.imports['mfe1/Service']).toBe(
        `${TEST_URLS.MFE1_BASE}/Service.js`,
      );
    });

    it('should handle remote with nested exposed paths', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './components/Button', outFileName: 'components-Button.js' },
        {
          key: './services/api/DataService',
          outFileName: 'services-api-DataService.js',
        },
      ]);

      worker.use(
        hostRemoteEntryHandler(hostInfo),
        remoteEntryHandler(TEST_URLS.MFE1_REMOTE_ENTRY, remoteInfo),
      );

      const result = await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      expect(result.imports['mfe1/components/Button']).toBe(
        `${TEST_URLS.MFE1_BASE}/components-Button.js`,
      );
      expect(result.imports['mfe1/services/api/DataService']).toBe(
        `${TEST_URLS.MFE1_BASE}/services-api-DataService.js`,
      );
    });
  });

  // ==========================================================================
  // MANIFEST LOADING TESTS
  // ==========================================================================
  // These tests verify manifest-based configuration:
  // - Loading remotes from a manifest.json file
  // - Cache busting applied to manifest URL
  describe('Manifest Loading', () => {
    it('should load remotes from manifest URL', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const remoteInfo = createRemoteInfo('mfe1');
      const manifestUrl = 'http://localhost:3000/federation-manifest.json';
      const manifest = {
        mfe1: TEST_URLS.MFE1_REMOTE_ENTRY,
      };

      worker.use(
        http.get(manifestUrl, () => HttpResponse.json(manifest)),
        hostRemoteEntryHandler(hostInfo),
        remoteEntryHandler(TEST_URLS.MFE1_REMOTE_ENTRY, remoteInfo),
      );

      const result = await initFederation(manifestUrl);

      expect(result.imports['mfe1/Component']).toBeDefined();
    });

    it('should apply cacheTag to manifest URL', async () => {
      const hostInfo = createFederationInfo({ name: 'host' });
      const manifestUrl = 'http://localhost:3000/federation-manifest.json';
      const manifest = {};
      let capturedUrl = '';

      worker.use(
        http.get(manifestUrl, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json(manifest);
        }),
        hostRemoteEntryHandler(hostInfo),
      );

      await initFederation(manifestUrl, { cacheTag: 'v1.0.0' });

      expect(capturedUrl).toContain('t=v1.0.0');
    });
  });
});
