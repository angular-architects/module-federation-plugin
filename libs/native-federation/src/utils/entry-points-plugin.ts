import type { Plugin, PluginBuild } from "esbuild";

/**
 * add entries to bundler's entryPoints
 * 
 * @param entries deps obj, which builder should handle as independent files
 */
export const entryPointsPlugin = (entries: Record<string, string>): Plugin => {
    return {
        name: 'entry-points',
        setup: (build: PluginBuild) => {
          build.initialOptions.entryPoints = {
            ...build.initialOptions.entryPoints,
            ...entries,
          }
        }
    }
}