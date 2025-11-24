import { http, HttpResponse } from 'msw';
import { setupWorker } from 'msw/browser';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it
} from 'vitest';
import {
    clearFederationDOMEffects,
    getImportMapContent,
} from './__test-helpers__/dom-helpers';
import {
    createHostInfo,
    createRemoteConfig,
    createRemoteInfo,
    TEST_URLS
} from './__test-helpers__/federation-fixtures';
import {
    FALLBACK_COMPONENTS
} from './__test-helpers__/module-fixtures';
import {
    createFederationHandlers,
    hostRemoteEntryHandler, remoteEntryHandler
} from './__test-helpers__/msw-handlers';
import { initFederation } from './init-federation';
import { loadRemoteModule } from './load-remote-module';
import { addRemote } from './model/remotes';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Helper to setup a basic federation environment with one remote
 */
async function setupFederationWithRemote(
  worker: ReturnType<typeof setupWorker>,
  remoteName = 'mfe1',
) {
  const hostInfo = createHostInfo();
  const remoteInfo = createRemoteInfo(remoteName);

  worker.use(
    ...createFederationHandlers({
      host: hostInfo,
      remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
    }),
  );

  await initFederation(
    createRemoteConfig({ name: remoteName, url: TEST_URLS.MFE1_REMOTE_ENTRY }),
  );

  return { hostInfo, remoteInfo };
}

/**
 * Helper to manually register a remote without calling initFederation
 */
function registerRemoteManually(
  remoteName: string,
  baseUrl: string,
  exposes: Array<{ key: string; outFileName: string }>,
) {
  addRemote(remoteName, {
    name: remoteName,
    baseUrl,
    exposes,
    shared: [],
  });
}

describe('loadRemoteModule - Browser Integration Test', () => {
  const worker = setupWorker();

  beforeAll(async () => {
    await worker.start({
      onUnhandledRequest: 'bypass', // Changed to bypass to avoid warnings
      quiet: true,
    });
  });

  afterAll(() => worker.stop());

  beforeEach(() => {
    clearFederationDOMEffects();
    // Reset handlers before each test to ensure clean state
    worker.resetHandlers();
  });

  afterEach(() => {
    // Additional cleanup
    worker.resetHandlers();
  });

  describe('Basic Loading - Success Case', () => {
    it('should successfully load and execute remote module', async () => {
      await setupFederationWithRemote(worker);

      // Serve a valid JavaScript module with multiple exports
      worker.use(
        http.get(`${TEST_URLS.MFE1_BASE}/Component.js`, () => {
          const moduleCode = `
            // Default export - a class
            export default class Component {
              constructor() {
                this.name = 'RemoteComponent';
                this.type = 'MFE1';
              }
              
              render() {
                return 'Rendered: ' + this.name;
              }
            }
            
            // Named exports
            export const version = '1.0.0';
            export const ComponentName = 'MFE1Component';
            
            export function render() {
              return 'Rendered from MFE1';
            }
            
            export const utils = {
              validate: () => true,
              format: (val) => String(val).toUpperCase()
            };
          `;
          return new HttpResponse(moduleCode, {
            headers: { 'Content-Type': 'application/javascript' },
          });
        }),
      );

      // Test with options object
      const module = await loadRemoteModule({
        remoteName: 'mfe1',
        exposedModule: './Component',
      });

      // Verify module was loaded and all exports work
      expect(module).toBeDefined();
      
      // Test default export (class)
      expect(module.default).toBeDefined();
      const instance = new module.default();
      expect(instance.name).toBe('RemoteComponent');
      expect(instance.type).toBe('MFE1');
      expect(instance.render()).toBe('Rendered: RemoteComponent');
      
      // Test named exports
      expect(module.version).toBe('1.0.0');
      expect(module.ComponentName).toBe('MFE1Component');
      expect(module.render).toBeTypeOf('function');
      expect(module.render()).toBe('Rendered from MFE1');
      
      // Test exported object with methods
      expect(module.utils).toBeDefined();
      expect(module.utils.validate()).toBe(true);
      expect(module.utils.format('test')).toBe('TEST');
    });
  });

  describe('Basic Loading - Additional Success Cases', () => {
    it('should load module using positional arguments', async () => {
      // Setup remote with Button module
      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './Component', outFileName: 'Component.js' },
        { key: './Button', outFileName: 'Button.js' },
      ]);

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      // Serve Button module
      worker.use(
        http.get(`${TEST_URLS.MFE1_BASE}/Button.js`, () => {
          const moduleCode = `
            export default class Button {
              constructor() {
                this.type = 'button';
              }
              click() {
                return 'Button clicked!';
              }
            }
            export const buttonType = 'primary';
          `;
          return new HttpResponse(moduleCode, {
            headers: { 'Content-Type': 'application/javascript' },
          });
        }),
      );

      // Load using positional arguments
      const module = await loadRemoteModule('mfe1', './Button');

      expect(module).toBeDefined();
      expect(module.default).toBeDefined();
      expect(module.buttonType).toBe('primary');
      
      const btn = new module.default();
      expect(btn.type).toBe('button');
      expect(btn.click()).toBe('Button clicked!');
    });

    it('should load module with only named exports', async () => {
      // Setup remote with Service module
      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './Component', outFileName: 'Component.js' },
        { key: './Service', outFileName: 'Service.js' },
      ]);

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      // Serve Service module with only named exports
      worker.use(
        http.get(`${TEST_URLS.MFE1_BASE}/Service.js`, () => {
          const moduleCode = `
            export const API_URL = 'https://api.example.com';
            
            export function fetchData() {
              return Promise.resolve({ data: 'test' });
            }
            
            export class DataService {
              getData() {
                return 'service data';
              }
            }
          `;
          return new HttpResponse(moduleCode, {
            headers: { 'Content-Type': 'application/javascript' },
          });
        }),
      );

      const module = await loadRemoteModule('mfe1', './Service');

      expect(module.API_URL).toBe('https://api.example.com');
      expect(module.fetchData).toBeTypeOf('function');
      expect(module.DataService).toBeDefined();
      
      const service = new module.DataService();
      expect(service.getData()).toBe('service data');
    });
  });

  // ==========================================================================
  // BASIC LOADING TESTS - FAILURE CASES
  // ==========================================================================
  // These tests verify error handling when modules fail to load
  // Using different module names to avoid caching conflicts
  describe('Basic Loading - Failure Cases', () => {
    it('should throw when module returns 404', async () => {
      // Setup remote with NotFound module
      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './Component', outFileName: 'Component.js' },
        { key: './NotFound', outFileName: 'NotFound.js' },
      ]);

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      worker.use(
        http.get(`${TEST_URLS.MFE1_BASE}/NotFound.js`, () => {
          return new HttpResponse(null, { status: 404 });
        }),
      );

      await expect(
        loadRemoteModule({
          remoteName: 'mfe1',
          exposedModule: './NotFound',
        }),
      ).rejects.toThrow();
    });

    it('should throw when module has syntax error', async () => {
      // Setup remote with Invalid module
      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './Component', outFileName: 'Component.js' },
        { key: './Invalid', outFileName: 'Invalid.js' },
      ]);

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      worker.use(
        http.get(`${TEST_URLS.MFE1_BASE}/Invalid.js`, () => {
          const invalidCode = `
            export default class {
              // Missing closing brace
          `;
          return new HttpResponse(invalidCode, {
            headers: { 'Content-Type': 'application/javascript' },
          });
        }),
      );

      await expect(
        loadRemoteModule('mfe1', './Invalid'),
      ).rejects.toThrow();
    });
  });

  describe('Lazy Loading', () => {
    it('should support remoteEntry option for lazy loading', async () => {
      // Initialize only host, no remotes
      const hostInfo = createHostInfo();
      worker.use(hostRemoteEntryHandler(hostInfo));
      await initFederation({});

      const remoteInfo = createRemoteInfo('mfe2', [
        { key: './LazyModule', outFileName: 'LazyModule.js' },
      ]);
      
      worker.use(
        remoteEntryHandler(TEST_URLS.MFE2_REMOTE_ENTRY, remoteInfo),
        http.get(`${TEST_URLS.MFE2_BASE}/LazyModule.js`, () => {
          const moduleCode = `
            export default class LazyModule {
              constructor() {
                this.loaded = 'lazy';
              }
            }
          `;
          return new HttpResponse(moduleCode, {
            headers: { 'Content-Type': 'application/javascript' },
          });
        }),
      );

      // Load module with remoteEntry - should fetch and register the remote
      const module = await loadRemoteModule({
        remoteEntry: TEST_URLS.MFE2_REMOTE_ENTRY,
        exposedModule: './LazyModule',
      });

      expect(module).toBeDefined();
      expect(module.default).toBeDefined();
      const instance = new module.default();
      expect(instance.loaded).toBe('lazy');
    });

    it('should not refetch remote if already initialized', async () => {

      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './Component', outFileName: 'Component.js' },
        { key: './CachedModule', outFileName: 'CachedModule.js' },
      ]);

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      let fetchCount = 0;
      worker.use(
        http.get(TEST_URLS.MFE1_REMOTE_ENTRY, () => {
          fetchCount++;
          return HttpResponse.json(remoteInfo);
        }),
        http.get(`${TEST_URLS.MFE1_BASE}/CachedModule.js`, () => {
          const moduleCode = `export const cached = true;`;
          return new HttpResponse(moduleCode, {
            headers: { 'Content-Type': 'application/javascript' },
          });
        }),
      );

      // Load with remoteEntry even though it's already initialized
      const module = await loadRemoteModule({
        remoteEntry: TEST_URLS.MFE1_REMOTE_ENTRY,
        exposedModule: './CachedModule',
      });

      // Should not fetch remoteEntry again since remote is already initialized
      expect(fetchCount).toBe(0);
      expect(module.cached).toBe(true);
    });

    it('should determine remote name from remoteEntry URL', async () => {
      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './ResolvedModule', outFileName: 'ResolvedModule.js' },
      ]);

      worker.use(
        hostRemoteEntryHandler(hostInfo),
        remoteEntryHandler(TEST_URLS.MFE1_REMOTE_ENTRY, remoteInfo),
        http.get(`${TEST_URLS.MFE1_BASE}/ResolvedModule.js`, () => {
          const moduleCode = `export const resolved = 'by-url';`;
          return new HttpResponse(moduleCode, {
            headers: { 'Content-Type': 'application/javascript' },
          });
        }),
      );

      await initFederation({});

      // Manually register the remote so we can test name resolution
      registerRemoteManually(TEST_URLS.MFE1_BASE, TEST_URLS.MFE1_BASE, [
        { key: './ResolvedModule', outFileName: 'ResolvedModule.js' },
      ]);

      // Load without remoteName, should resolve from remoteEntry
      const module = await loadRemoteModule({
        remoteEntry: TEST_URLS.MFE1_REMOTE_ENTRY,
        exposedModule: './ResolvedModule',
      });

      expect(module.resolved).toBe('by-url');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when remote is not found and no fallback', async () => {
      await setupFederationWithRemote(worker);

      await expect(
        loadRemoteModule('unknown-remote', './Component'),
      ).rejects.toThrow('unknown remote unknown-remote');
    });

    it('should return fallback when remote is not found', async () => {
      await setupFederationWithRemote(worker);

      const result = await loadRemoteModule({
        remoteName: 'unknown-remote',
        exposedModule: './Component',
        fallback: FALLBACK_COMPONENTS.DefaultComponent,
      });

      expect(result).toBe(FALLBACK_COMPONENTS.DefaultComponent);
    });

    it('should throw error when exposed module is not found and no fallback', async () => {
      await setupFederationWithRemote(worker);

      await expect(
        loadRemoteModule('mfe1', './UnknownModule'),
      ).rejects.toThrow('Unknown exposed module ./UnknownModule in remote mfe1');
    });

    it('should return fallback when exposed module is not found', async () => {
      await setupFederationWithRemote(worker);

      const result = await loadRemoteModule({
        remoteName: 'mfe1',
        exposedModule: './UnknownModule',
        fallback: FALLBACK_COMPONENTS.DefaultComponent,
      });

      expect(result).toBe(FALLBACK_COMPONENTS.DefaultComponent);
    });

    it('should throw error when module import fails and no fallback', async () => {

      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './Component', outFileName: 'Component.js' },
        { key: './FailModule', outFileName: 'FailModule.js' },
      ]);

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      worker.use(
        http.get(`${TEST_URLS.MFE1_BASE}/FailModule.js`, () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      await expect(
        loadRemoteModule('mfe1', './FailModule'),
      ).rejects.toThrow();
    });

    it('should throw error when module import fails even with fallback', async () => {

      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './Component', outFileName: 'Component.js' },
        { key: './ErrorModule', outFileName: 'ErrorModule.js' },
      ]);

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      // Mock the module file to return 404
      worker.use(
        http.get(`${TEST_URLS.MFE1_BASE}/ErrorModule.js`, () => {
          return new HttpResponse(null, { status: 404 });
        }),
      );

      // In browser mode, dynamic import failures throw before the catch block
      // This is expected behavior - the fallback can't catch import errors
      await expect(
        loadRemoteModule({
          remoteName: 'mfe1',
          exposedModule: './ErrorModule',
          fallback: FALLBACK_COMPONENTS.ErrorComponent,
        }),
      ).rejects.toThrow();
    });

    it('should handle null fallback gracefully', async () => {
      await setupFederationWithRemote(worker);

      // null is not considered a valid fallback, so it should throw
      await expect(
        loadRemoteModule({
          remoteName: 'unknown-remote',
          exposedModule: './Component',
          fallback: null,
        }),
      ).rejects.toThrow('unknown remote unknown-remote');
    });

    it('should log error in browser environment when using fallback', async () => {
      await setupFederationWithRemote(worker);

      const [errorMessages, cleanup] = captureConsoleErrorMessages();

      await loadRemoteModule({
        remoteName: 'unknown-remote',
        exposedModule: './Component',
        fallback: FALLBACK_COMPONENTS.DefaultComponent,
      });

      expect(errorMessages.length).toBeGreaterThan(0);
      expect(errorMessages[0]).toContain('unknown remote');

      cleanup();
    });
  });

  describe('Argument Validation', () => {
    it('should throw error when neither remoteName nor remoteEntry is provided', async () => {
      await setupFederationWithRemote(worker);

      await expect(
        loadRemoteModule({
          exposedModule: './Component',
        } as any),
      ).rejects.toThrow('Please pass remoteName or remoteEntry');
    });

    it('should throw error with invalid argument combination', async () => {
      await setupFederationWithRemote(worker);

      await expect(
        loadRemoteModule('mfe1' as any, undefined as any),
      ).rejects.toThrow('please pass options or a remoteName/exposedModule-pair');
    });

    it('should throw error when exposedModule is missing in options', async () => {
      await setupFederationWithRemote(worker);

      await expect(
        loadRemoteModule({
          remoteName: 'mfe1',
        } as any),
      ).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple modules from same remote', async () => {
      // Setup remote with multiple exposed modules
      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('mfe1', [
        { key: './Component', outFileName: 'Component.js' },
        { key: './Button', outFileName: 'Button.js' },
        { key: './Service', outFileName: 'Service.js' },
      ]);

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      // Verify all modules are exposed in import map
      const importMapContent = getImportMapContent();
      expect(importMapContent).toBeDefined();
      expect(importMapContent!.imports['mfe1/Component']).toBeDefined();
      expect(importMapContent!.imports['mfe1/Button']).toBeDefined();
      expect(importMapContent!.imports['mfe1/Service']).toBeDefined();
    });

    it('should handle nested module paths', async () => {
      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('mfe1', [
        {
          key: './components/Button',
          outFileName: 'components-Button.js',
        },
      ]);

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [{ url: TEST_URLS.MFE1_REMOTE_ENTRY, info: remoteInfo }],
        }),
      );

      await initFederation(
        createRemoteConfig({ name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY }),
      );

      // Verify nested path is in import map
      const importMapContent = getImportMapContent();
      expect(importMapContent?.imports['mfe1/components/Button']).toBe(
        `${TEST_URLS.MFE1_BASE}/components-Button.js`,
      );
    });

    it('should handle special characters in remote names', async () => {
      const hostInfo = createHostInfo();
      const remoteInfo = createRemoteInfo('my-mfe-1', [
        { key: './Component', outFileName: 'Component.js' },
      ]);

      worker.use(
        hostRemoteEntryHandler(hostInfo),
        remoteEntryHandler(TEST_URLS.MFE1_REMOTE_ENTRY, remoteInfo),
      );

      await initFederation(
        createRemoteConfig({
          name: 'my-mfe-1',
          url: TEST_URLS.MFE1_REMOTE_ENTRY,
        }),
      );

      // Verify remote with special characters is registered
      const importMapContent = getImportMapContent();
      expect(importMapContent?.imports['my-mfe-1/Component']).toBeDefined();
    });

    it('should work with remotes from different base URLs', async () => {
      const hostInfo = createHostInfo();
      const mfe1Info = createRemoteInfo('mfe1');
      const mfe2Info = createRemoteInfo('mfe2');

      worker.use(
        ...createFederationHandlers({
          host: hostInfo,
          remotes: [
            { url: TEST_URLS.MFE1_REMOTE_ENTRY, info: mfe1Info },
            { url: TEST_URLS.MFE2_REMOTE_ENTRY, info: mfe2Info },
          ],
        }),
      );

      await initFederation(
        createRemoteConfig(
          { name: 'mfe1', url: TEST_URLS.MFE1_REMOTE_ENTRY },
          { name: 'mfe2', url: TEST_URLS.MFE2_REMOTE_ENTRY },
        ),
      );

      // Verify both remotes are registered with different base URLs
      const importMapContent = getImportMapContent();
      expect(importMapContent?.imports['mfe1/Component']).toContain('localhost:3000');
      expect(importMapContent?.imports['mfe2/Component']).toContain('localhost:4000');
    });
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper to capture console error messages
 */
function captureConsoleErrorMessages(): [string[], () => void] {
  const messages: string[] = [];
  const originalError = console.error;
  console.error = (...args: any[]) => {
    messages.push(args.join(' '));
  };
  const cleanup = () => {
    console.error = originalError;
  };
  return [messages, cleanup];
}

