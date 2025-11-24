/**
 * Test fixtures for loadRemoteModule tests
 */

/**
 * Creates a mock ES module with exports
 */
export const createMockModule = <T = any>(exports: T): T => exports;

/**
 * Common mock modules for testing
 */
export const MOCK_MODULES = {
  Component: createMockModule({
    default: class MockComponent {
      name = 'MockComponent';
    },
    namedExport: 'test-value',
  }),

  Button: createMockModule({
    default: class MockButton {
      name = 'MockButton';
      click() {
        return 'clicked';
      }
    },
  }),

  Service: createMockModule({
    DataService: class DataService {
      getData() {
        return { data: 'test' };
      }
    },
    ApiService: class ApiService {
      fetch() {
        return Promise.resolve({ ok: true });
      }
    },
  }),

  EmptyModule: createMockModule({}),

  SimpleValue: createMockModule({
    value: 42,
    message: 'Hello from remote',
  }),
};

/**
 * Creates a mock module URL for testing
 */
export const createModuleUrl = (baseUrl: string, fileName: string): string => {
  return `${baseUrl}/${fileName}`;
};

/**
 * Fallback components for testing
 */
export const FALLBACK_COMPONENTS = {
  DefaultComponent: class DefaultComponent {
    name = 'DefaultComponent';
  },
  
  ErrorComponent: class ErrorComponent {
    name = 'ErrorComponent';
    error = true;
  },
  
  NullFallback: null,
};

