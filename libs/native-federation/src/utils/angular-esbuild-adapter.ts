import { BuildAdapter } from '@softarc/native-federation/build';
import * as esbuild from 'esbuild';
import { createCompilerPlugin } from '@angular-devkit/build-angular/src/builders/browser-esbuild/compiler-plugin';
import { createSharedMappingsPlugin } from './shared-mappings-plugin';

export const AngularEsBuildAdapter: BuildAdapter = async (options) => {
  const { entryPoint, tsConfigPath, external, outfile, mappedPaths } = options;

  await esbuild.build({
    entryPoints: [entryPoint],
    external,
    outfile,
    bundle: true,
    sourcemap: true,
    minify: true,
    format: 'esm',
    target: ['esnext'],
    plugins: [
      createCompilerPlugin(
        {
          sourcemap: true,
          tsconfig: tsConfigPath,
          advancedOptimizations: true,
          thirdPartySourcemaps: true,
        },
        {
          optimization: true,
          sourcemap: true,
          workspaceRoot: __dirname,
        }
      ),
      ...(mappedPaths && mappedPaths.length > 0
        ? [createSharedMappingsPlugin(mappedPaths)]
        : []),
    ],
  });
};
