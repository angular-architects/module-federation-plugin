import { logging } from "@angular-devkit/core";
import { loadCustomPlugins } from "./load-custom-plugins";
import { Plugin } from "esbuild";
import { PluginConfig } from "./custom-plugins.entity";

/**
 * Add custom plugins to the plugins array
 * @param plugins The array of plugins to add to
 * @param pluginConfig The plugin configuration
 * @param workspaceRoot The workspace root
 * @param tsConfig The tsconfig path
 * @param logger The logger
 */
export async function addCustomPlugins(plugins: Plugin[], pluginConfig: PluginConfig[] | undefined,
    workspaceRoot: string,
    tsConfig: string,
    logger: logging.LoggerApi): Promise<void> {
    const codePlugins = await loadCustomPlugins(pluginConfig, workspaceRoot, tsConfig, logger);
    plugins.push(...codePlugins);
}