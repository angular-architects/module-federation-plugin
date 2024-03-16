import { processRemoteInfo } from './init-federation';
import { getDirectory } from './utils/path-utils';
import { getRemoteNameByBaseUrl, isRemoteInitialized } from './model/remotes';

export type LoadRemoteModuleOptions = {
  remoteEntry?: string;
  remoteName?: string;
  exposedModule: string;
};

export async function loadRemoteModule<
  Default = any,
  Exports extends object = any
>(options: LoadRemoteModuleOptions): Promise<{ default: Default } & Exports>;
export async function loadRemoteModule<
  Default = any,
  Exports extends object = any
>(
  remoteName: string,
  exposedModule: string
): Promise<{ default: Default } & Exports>;
export async function loadRemoteModule<
  Default = any,
  Exports extends object = any
>(
  optionsOrRemoteName: LoadRemoteModuleOptions | string,
  exposedModule?: string
): Promise<{ default: Default } & Exports> {
  const options = normalizeOptions(optionsOrRemoteName, exposedModule);

  await ensureRemoteInitialized(options);

  const remoteName = getRemoteNameByOptions(options);

  const module = await importShim<Default, Exports>(
    `${remoteName}/${options.exposedModule}`
  );
  return module;
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
      'unexpcted arguments: Please pass remoteName or remoteEntry'
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
    importShim.addImportMap(importMap);
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
