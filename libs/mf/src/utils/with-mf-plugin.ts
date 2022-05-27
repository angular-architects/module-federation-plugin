import { findRootTsConfigJson, shareAll } from './share-utils';
import { SharedMappings } from './shared-mappings';

const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");

export function withModuleFederationPlugin(config: unknown) {

    const sharedMappings = config['sharedMappings'];
    delete config['sharedMappings'];

    const mappings = new SharedMappings();
    mappings.register(findRootTsConfigJson(), sharedMappings);

    if (!config['library']) {
        config['library'] = {
            type: 'module'
        }
    }

    if (!config['filename']) {
        config['filename'] = 'remoteEntry.js';
    }

    if (!config['shared']) {
        config['shared'] = shareAll(
            { singleton: true, strictVersion: true, requiredVersion: 'auto'});
    }

    if (typeof config['shared'] === 'object') {
        config['shared'] = {
            ...config['shared'],
            ...mappings.getDescriptors()
        }
    }

    if (Array.isArray(config['shared'])) {
        config['shared'] = [
            ...config['shared'],
            mappings.getDescriptors()
        ]
    }

    const isModule = config['library']?.['type'] === 'module';

    return {
        output: {
          publicPath: "auto"
        },
        optimization: {
          runtimeChunk: false
        },   
        resolve: {
          alias: {
            ...mappings.getAliases(),
          }
        },
        ...(isModule) ? { 
            experiments: {
                outputModule: true
            }
        } : {},
        plugins: [
          new ModuleFederationPlugin(config),
          mappings.getPlugin()
        ],
      };
}  