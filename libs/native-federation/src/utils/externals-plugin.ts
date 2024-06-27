import type { Plugin, PluginBuild } from "esbuild";

export const externalsPlugin = (externals: string[]): Plugin => {
    return {
        name: 'externals',
        setup(build: PluginBuild) {
          if (build.initialOptions.platform !== 'node') {
            build.initialOptions.external = externals.filter(
              (e) => e !== 'tslib'
            );
          }
        },
      }
}