export type LoadRemoteModuleOptions = {
    remoteEntry?: string;
    remoteName?: string;
    exposedModule: string;
};

export async function loadRemoteModule<T = any>(options: LoadRemoteModuleOptions) : Promise<T>;
export async function loadRemoteModule<T = any>(remoteName: string, exposedModule: string) : Promise<T>;
export async function loadRemoteModule<T = any>(optionsOrRemoteName: LoadRemoteModuleOptions | string, exposedModule?: string): Promise<T> {

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

    if (!options.remoteName && !options.remoteEntry) {
        throw new Error('uexpected arguments: please pass a remoteName OR a remoteEntry url');
    }

    if (!options.remoteName) {
        
    }



}

