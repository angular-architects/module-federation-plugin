import { Plugin, PluginBuild } from 'esbuild';
import * as path from 'path';
import { MappedPath } from './mapped-paths';

export function createSharedMappingsPlugin(mappedPaths: MappedPath[]): Plugin {
  return {
    name: 'custom',
    setup(build: PluginBuild) {
      build.onResolve({ filter: /^[.]/ }, async (args) => {
        let mappedPath: MappedPath | null = null;
        if (
          args.path.includes('playground-lib') &&
          args.kind === 'import-statement'
        ) {
          const importPath = path.join(args.resolveDir, args.path);
          mappedPath = mappedPaths.find((p) =>
            importPath.startsWith(path.dirname(p.path))
          );
        }

        if (mappedPath) {
          return {
            path: mappedPath.key,
            external: true,
          };
        }

        return {};
      });
    },
  };
}
