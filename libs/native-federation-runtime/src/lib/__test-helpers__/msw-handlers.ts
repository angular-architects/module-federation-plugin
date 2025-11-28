import { delay, http, HttpResponse } from 'msw';
import type { FederationInfo } from '../model/federation-info';
import {
  createHostInfo,
  createRemoteInfo,
  TEST_URLS,
} from './federation-fixtures';

/**
 * MSW request handlers for federation tests
 */

/**
 * Creates a handler that returns the host remoteEntry.json
 */
export const hostRemoteEntryHandler = (
  info: FederationInfo = createHostInfo(),
  options?: { delay?: number },
) => {
  return http.get(TEST_URLS.HOST_REMOTE_ENTRY, async () => {
    if (options?.delay) {
      await delay(options.delay);
    }
    return HttpResponse.json(info);
  });
};

/**
 * Creates a handler for a remote MFE remoteEntry.json
 */
export const remoteEntryHandler = (
  url: string,
  info: FederationInfo,
  options?: { delay?: number; status?: number },
) => {
  return http.get(url, async () => {
    if (options?.delay) {
      await delay(options.delay);
    }

    if (options?.status && options.status !== 200) {
      return new HttpResponse(null, { status: options.status });
    }

    return HttpResponse.json(info);
  });
};

/**
 * Creates a handler that returns 404 for any remoteEntry.json
 */
export const notFoundHandler = (url: string) => {
  return http.get(url, () => {
    return new HttpResponse(null, { status: 404 });
  });
};

/**
 * Creates a handler that returns network error
 */
export const networkErrorHandler = (url: string) => {
  return http.get(url, () => {
    return HttpResponse.error();
  });
};

/**
 * Creates a handler that returns malformed JSON
 */
export const malformedJsonHandler = (url: string) => {
  return http.get(url, () => {
    return new HttpResponse('{ invalid json', {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
};

/**
 * Creates a handler that times out
 */
export const timeoutHandler = (url: string, timeoutMs = 5000) => {
  return http.get(url, async () => {
    await delay(timeoutMs);
    return HttpResponse.json({});
  });
};

/**
 * Default handlers for common scenarios
 */
export const defaultHandlers = [
  hostRemoteEntryHandler(),
  remoteEntryHandler(TEST_URLS.MFE1_REMOTE_ENTRY, createRemoteInfo('mfe1')),
  remoteEntryHandler(
    TEST_URLS.MFE2_REMOTE_ENTRY,
    createRemoteInfo('mfe2', [{ key: './Button', outFileName: 'Button.js' }]),
  ),
];

/**
 * Creates handlers for a complete federation scenario
 */
export const createFederationHandlers = (config: {
  host?: FederationInfo;
  remotes?: Array<{ url: string; info: FederationInfo }>;
}) => {
  const handlers = [hostRemoteEntryHandler(config.host || createHostInfo())];

  if (config.remotes) {
    config.remotes.forEach(({ url, info }) => {
      handlers.push(remoteEntryHandler(url, info));
    });
  }

  return handlers;
};

/**
 * Creates a handler that returns a JavaScript module
 */
export const moduleHandler = (url: string, moduleContent: any) => {
  return http.get(url, () => {
    // Return JavaScript module as text
    const moduleCode = `
      export default ${JSON.stringify(moduleContent.default || {})};
      ${Object.entries(moduleContent)
        .filter(([key]) => key !== 'default')
        .map(
          ([key, value]) => `export const ${key} = ${JSON.stringify(value)};`,
        )
        .join('\n')}
    `;

    return new HttpResponse(moduleCode, {
      headers: {
        'Content-Type': 'application/javascript',
      },
    });
  });
};

/**
 * Creates a handler that returns a 404 for a module
 */
export const moduleNotFoundHandler = (url: string) => {
  return http.get(url, () => {
    return new HttpResponse(null, { status: 404 });
  });
};

/**
 * Creates a handler that returns invalid JavaScript
 */
export const invalidModuleHandler = (url: string) => {
  return http.get(url, () => {
    return new HttpResponse('this is not valid javascript {{{', {
      headers: {
        'Content-Type': 'application/javascript',
      },
    });
  });
};
