/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadRemote } from '@module-federation/enhanced/runtime';

export type LoadRemoteModuleOptions<T = any> = {
  remoteName: string;
  exposedModule: string;
  fallback?: T;
};

export async function loadRemoteModule<T = any>(
  remoteName: string,
  exposedModule: string,
): Promise<T>;
export async function loadRemoteModule<T = any>(
  options: LoadRemoteModuleOptions,
): Promise<T>;
export async function loadRemoteModule<T = any>(
  optionsOrRemoteName: LoadRemoteModuleOptions<T> | string,
  exposedModule?: string,
): Promise<T> {
  const options = normalize(optionsOrRemoteName, exposedModule);

  const remote = options.remoteName;
  const exposed = normalizeExposed(options.exposedModule);

  const url = [remote, exposed].join('/');

  let result: T | null = null;
  let error: unknown;

  try {
    result = await loadRemote<T>(url);
  } catch (e) {
    error = e;
  }

  if (!error && result) {
    return result;
  }

  if (options.fallback) {
    return options.fallback;
  }

  if (error) {
    throw error;
  }

  throw new Error('could not load ' + url);
}

function normalize<T>(
  optionsOrRemoteName: LoadRemoteModuleOptions<T> | string,
  exposedModule?: string,
): LoadRemoteModuleOptions<T> {
  if (typeof optionsOrRemoteName === 'string') {
    return {
      remoteName: optionsOrRemoteName,
      exposedModule: exposedModule ?? '',
    };
  } else {
    return optionsOrRemoteName;
  }
}

function normalizeExposed(exposed: string): string {
  if (exposed.startsWith('./')) {
    return exposed.substring(2);
  }
  return exposed;
}
