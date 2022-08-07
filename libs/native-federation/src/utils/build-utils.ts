import * as esbuild from 'esbuild';
import {createCompilerPlugin }
  from '@angular-devkit/build-angular/src/builders/browser-esbuild/compiler-plugin';
import { MappedPath } from './mapped-paths';
import { createSharedMappingsPlugin } from './shared-mappings-plugin';

export async function bundle({ entryPoint, tsConfigPath, external, outfile, mappedPaths }: { entryPoint: string; tsConfigPath: string; external: Array<string>; outfile: string; mappedPaths: MappedPath[] }) {
    await esbuild.build({
        entryPoints: [entryPoint],
        external,
        outfile,
        bundle: true,
        sourcemap: true,
        minify: true,
        format: "esm",
        target: ["esnext"],
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
            createSharedMappingsPlugin(mappedPaths),
        ],
    });
}
