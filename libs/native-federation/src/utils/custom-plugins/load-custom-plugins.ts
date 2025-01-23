import * as path from 'node:path';
import type { Plugin } from 'esbuild';
import type { logging } from '@angular-devkit/core';
import { loadModule } from '@angular-builders/common';
import { PluginConfig } from './custom-plugins.entity';

/*
 * Stolen from https://github.com/just-jeb/angular-builders/blob/master/packages/custom-esbuild/src/load-plugins.ts
 */

/**
 * Load custom plugins from the plugin configuration array
 * @param plugins The array of plugins to add to
 * @param pluginConfig The plugin configuration
 * @param workspaceRoot The workspace root
 * @param tsConfig The tsconfig path
 * @param logger The logger
 * @returns The loaded plugins
 */
export async function loadCustomPlugins(
    pluginConfig: PluginConfig[] | undefined,
    workspaceRoot: string,
    tsConfig: string,
    logger: logging.LoggerApi,
): Promise<Plugin[]> {
    const plugins = await Promise.all(
        (pluginConfig || [])
            .map(async pluginConfig => {
                if (typeof pluginConfig === 'string') {
                    return loadModule<Plugin | Plugin[]>(path.join(workspaceRoot, pluginConfig), tsConfig, logger);
                } else {
                    const pluginFactory = await loadModule<(...args: any[]) => Plugin>(path.join(workspaceRoot, pluginConfig.path), tsConfig, logger);
                    return pluginFactory(pluginConfig.options);
                }

            }),
    );

    return plugins.flat();
}