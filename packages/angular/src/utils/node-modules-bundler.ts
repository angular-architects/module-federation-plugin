import * as esbuild from 'esbuild';
import * as path from 'path';

import { transformSupportedBrowsersToTargets, getSupportedBrowsers } from '@angular/build/private';

import type { BuilderContext } from '@angular-devkit/architect';

import { normalizeSourceMaps } from '@angular-devkit/build-angular/src/utils/index.js';

import type { ApplicationBuilderOptions } from '@angular/build';
import type { EntryPoint } from '@softarc/native-federation';
import type { MappedPath } from '@softarc/native-federation/internal';

import { createSharedMappingsPlugin } from './shared-mappings-plugin.js';

export interface NodeModulesBundleResult {
  ctx: esbuild.BuildContext;
  pluginDisposed: Promise<void>;
}

/**
 * Lightweight esbuild context for bundling node_modules.
 * Skips the Angular compiler plugin since:
 * - node_modules are already compiled JavaScript
 * - Ivy partial compilation is handled by the separate link() step using Babel
 */
export async function createNodeModulesEsbuildContext(
  builderOptions: ApplicationBuilderOptions,
  context: BuilderContext,
  entryPoints: EntryPoint[],
  external: string[],
  outdir: string,
  mappedPaths: MappedPath[],
  dev?: boolean,
  hash: boolean = false,
  chunks?: boolean,
  platform?: 'browser' | 'node'
): Promise<NodeModulesBundleResult> {
  const workspaceRoot = context.workspaceRoot;

  const projectMetadata = await context.getProjectMetadata(context.target!.project);
  const projectRoot = path.join(
    workspaceRoot,
    (projectMetadata['root'] as string | undefined) ?? ''
  );

  const browsers = getSupportedBrowsers(projectRoot, context.logger as unknown as Console);
  const target = transformSupportedBrowsersToTargets(browsers);

  const sourcemapOptions = normalizeSourceMaps(builderOptions.sourceMap!);

  const commonjsPluginModule = await import('@chialab/esbuild-plugin-commonjs');
  const commonjsPlugin = commonjsPluginModule.default;

  const config: esbuild.BuildOptions = {
    entryPoints: entryPoints.map(ep => ({
      in: ep.fileName,
      out: path.parse(ep.outName).name,
    })),
    outdir,
    entryNames: hash ? '[name]-[hash]' : '[name]',
    write: false,
    external,
    logLevel: 'warning',
    bundle: true,
    sourcemap: sourcemapOptions.scripts,
    minify: !dev,
    supported: {
      'async-await': false,
      'object-rest-spread': false,
    },
    splitting: chunks,
    platform: platform ?? 'browser',
    format: 'esm',
    target: target,
    logLimit: 1,
    plugins: [
      ...(mappedPaths && mappedPaths.length > 0 ? [createSharedMappingsPlugin(mappedPaths)] : []),
      commonjsPlugin(),
    ],
    define: {
      ...(!dev ? { ngDevMode: 'false' } : {}),
      ngJitMode: 'false',
    },
    ...(builderOptions.loader ? { loader: builderOptions.loader } : {}),
    resolveExtensions: ['.mjs', '.js', '.cjs'],
  };

  const ctx = await esbuild.context(config);

  return { ctx, pluginDisposed: Promise.resolve() };
}
