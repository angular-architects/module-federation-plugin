/* eslint-disable @typescript-eslint/no-explicit-any */
import { appendImportMap } from "./utils/add-import-map";
import { processRemoteInfo } from "./init-federation";
import { getRemote, getRemoteNameByBaseUrl, isRemoteInitialized } from "./model/remotes";
import { getDirectory, joinPaths } from "./utils/path-utils";

declare function importShim<T>(url: string): T;

export type LoadRemoteModuleOptions = {
    remoteEntry?: string;
    remoteName?: string;
    exposedModule: string;
};

export async function loadRemoteModule<T = any>(options: LoadRemoteModuleOptions) : Promise<T>;
export async function loadRemoteModule<T = any>(remoteName: string, exposedModule: string) : Promise<T>;
export async function loadRemoteModule<T = any>(optionsOrRemoteName: LoadRemoteModuleOptions | string, exposedModule?: string): Promise<T> {

    const options = normalizeOptions(optionsOrRemoteName, exposedModule);

    await ensureRemoteInitialized(options);

    const remoteName = getRemoteNameByOptions(options);
    const remote = getRemote(remoteName);

    if (!remote) {
        throw new Error('unknown remote ' + remoteName);
    }

    const exposed = remote.exposes.find(e => e.key === options.exposedModule);

    if (!exposed) {
        throw new Error(`Unknown exposed module ${options.exposedModule} in remote ${remoteName}`);
    }

    const url = joinPaths(remote.baseUrl, exposed.outFileName);
    const module = await importShim<T>(url);

    return module;
}

function getRemoteNameByOptions(options: LoadRemoteModuleOptions) {
    let remoteName;

    if (options.remoteName) {
        remoteName = options.remoteName;
    }
    else if (options.remoteEntry) {
        const baseUrl = getDirectory(options.remoteEntry);
        remoteName = getRemoteNameByBaseUrl(baseUrl);
    }
    else {
        throw new Error('unexpcted arguments: Please pass remoteName or remoteEntry');
    }

    if (!remoteName) {
        throw new Error('unknown remoteName ' + remoteName);
    }
    return remoteName;
}

async function ensureRemoteInitialized(options: LoadRemoteModuleOptions): Promise<void> {
    if (options.remoteEntry && !isRemoteInitialized(getDirectory(options.remoteEntry))) {
        const importMap = await processRemoteInfo(options.remoteEntry);
        appendImportMap(importMap);
    }
}

function normalizeOptions(optionsOrRemoteName: string | LoadRemoteModuleOptions, exposedModule: string | undefined): LoadRemoteModuleOptions {
    let options: LoadRemoteModuleOptions;

    if (typeof optionsOrRemoteName === 'string' && exposedModule) {
        options = {
            remoteName: optionsOrRemoteName,
            exposedModule
        };
    }
    else if (typeof optionsOrRemoteName === 'object' && !exposedModule) {
        options = optionsOrRemoteName;
    }
    else {
        throw new Error('unexpected arguments: please pass options or a remoteName/exposedModule-pair');
    }
    return options;
}

