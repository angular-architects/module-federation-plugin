/* eslint-disable @typescript-eslint/no-explicit-any */
import { appendImportMap } from './utils/add-import-map';
import { processRemoteInfo } from './init-federation';
import {
  getRemote,
  getRemoteNameByBaseUrl,
  isRemoteInitialized,
} from './model/remotes';
import { getDirectory, joinPaths } from './utils/path-utils';

declare function importShim<T>(url: string): T;

export type LoadRemoteModuleOptions<T = any> = {
  remoteEntry?: string;
  remoteName?: string;
  exposedModule: string;
  fallback?: T;
};

export async function loadRemoteModule<T = any>(
  options: LoadRemoteModuleOptions
): Promise<T>;
export async function loadRemoteModule<T = any>(
  remoteName: string,
  exposedModule: string
): Promise<T>;
export async function loadRemoteModule<T = any>(
  optionsOrRemoteName: LoadRemoteModuleOptions<T> | string,
  exposedModule?: string
): Promise<T> {
  const options = normalizeOptions(optionsOrRemoteName, exposedModule);

  await ensureRemoteInitialized(options);

  const remoteName = getRemoteNameByOptions(options);
  const remote = getRemote(remoteName);
  const fallback = options.fallback;

  const remoteError = !remote ? 'unknown remote ' + remoteName : '';

  if (!remote && !fallback) {
    throw new Error(remoteError);
  } else if (!remote) {
    logClientError(remoteError);
    return Promise.resolve(fallback);
  }

  const exposed = remote.exposes.find((e) => e.key === options.exposedModule);

  const exposedError = !exposed
    ? `Unknown exposed module ${options.exposedModule} in remote ${remoteName}`
    : '';

  if (!exposed && !fallback) {
    throw new Error(exposedError);
  } else if (!exposed) {
    logClientError(exposedError);
    return Promise.resolve(fallback);
  }

  const url = joinPaths(remote.baseUrl, exposed.outFileName);

  try {
    const module = _import<T>(url);
    return module;
  } catch (e) {
    if (fallback) {
      console.error('error loading remote module', e);
      return fallback;
    }
    throw e;
  }
}

function _import<T = any>(url: string) {
  return typeof importShim !== 'undefined'
    ? importShim<T>(url)
    : (import(/* @vite-ignore */ url) as T);
}

function getRemoteNameByOptions(options: LoadRemoteModuleOptions) {
  let remoteName;

  if (options.remoteName) {
    remoteName = options.remoteName;
  } else if (options.remoteEntry) {
    const baseUrl = getDirectory(options.remoteEntry);
    remoteName = getRemoteNameByBaseUrl(baseUrl);
  } else {
    throw new Error(
      'unexpected arguments: Please pass remoteName or remoteEntry'
    );
  }

  if (!remoteName) {
    throw new Error('unknown remoteName ' + remoteName);
  }
  return remoteName;
}

async function ensureRemoteInitialized(
  options: LoadRemoteModuleOptions
): Promise<void> {
  if (
    options.remoteEntry &&
    !isRemoteInitialized(getDirectory(options.remoteEntry))
  ) {
    const importMap = await processRemoteInfo(options.remoteEntry);
    appendImportMap(importMap);
  }
}

function normalizeOptions(
  optionsOrRemoteName: string | LoadRemoteModuleOptions,
  exposedModule: string | undefined
): LoadRemoteModuleOptions {
  let options: LoadRemoteModuleOptions;

  if (typeof optionsOrRemoteName === 'string' && exposedModule) {
    options = {
      remoteName: optionsOrRemoteName,
      exposedModule,
    };
  } else if (typeof optionsOrRemoteName === 'object' && !exposedModule) {
    options = optionsOrRemoteName;
  } else {
    throw new Error(
      'unexpected arguments: please pass options or a remoteName/exposedModule-pair'
    );
  }
  return options;
}

function logClientError(error: string): void {
  if (typeof window !== 'undefined') {
    console.error(error);
  }
}
