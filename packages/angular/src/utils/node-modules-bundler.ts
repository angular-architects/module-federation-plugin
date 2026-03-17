import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';

import {
  transformSupportedBrowsersToTargets,
  getSupportedBrowsers,
  JavaScriptTransformer,
  Cache,
} from '@angular/build/private';

import { normalizeSourceMaps } from '@angular-devkit/build-angular/src/utils/index.js';

import { createSharedMappingsPlugin } from './shared-mappings-plugin.js';
import type { NormalizedContextOptions } from './normalize-context-options.js';

const LINKER_DECLARATION_PREFIX = 'ɵɵngDeclare';

/**
 * Excludes @angular/core and @angular/compiler which define the declarations
 * and would cause false positives.
 */
function requiresLinking(filePath: string, source: string): boolean {
  if (/[\\/]@angular[\\/](?:compiler|core)[\\/]/.test(filePath)) {
    return false;
  }

  return source.includes(LINKER_DECLARATION_PREFIX);
}

/**
 * Creates an esbuild plugin that applies the Angular linker to partially compiled
 * Angular libraries like a design system.
 *
 * Uses Angular's JavaScriptTransformer which handles linking internally.
 */
function createAngularLinkerPlugin(
  jsTransformer: JavaScriptTransformer,
  advancedOptimizations: boolean
): esbuild.Plugin {
  return {
    name: 'angular-linker',
    setup(build) {
      build.onLoad({ filter: /\.m?js$/ }, async args => {
        const contents = await fs.promises.readFile(args.path, 'utf-8');

        const needsLinking = requiresLinking(args.path, contents);

        if (!needsLinking && !advancedOptimizations) {
          return null;
        }

        const result = await jsTransformer.transformData(
          args.path,
          contents,
          !needsLinking,
          undefined
        );

        return {
          contents: Buffer.from(result).toString('utf-8'),
          loader: 'js',
        };
      });
    },
  };
}

const jsTransformerCacheStores = new Map<string, Map<string, Uint8Array>>();

function getOrCreateJsTransformerCacheStore(cachePath: string): Map<string, Uint8Array> {
  let store = jsTransformerCacheStores.get(cachePath);
  if (!store) {
    store = new Map<string, Uint8Array>();
    jsTransformerCacheStores.set(cachePath, store);
  }
  return store;
}

export async function createNodeModulesEsbuildContext(options: NormalizedContextOptions): Promise<{
  ctx: esbuild.BuildContext;
  pluginDisposed: Promise<void>;
}> {
  const {
    builderOptions,
    context,
    entryPoints,
    external,
    outdir,
    mappedPaths,
    cache,
    dev,
    hash,
    chunks,
    platform,
  } = options;

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

  // Create JavaScriptTransformer for handling Angular partial compilation linking
  const advancedOptimizations = !dev;
  const jsTransformerCacheStore = getOrCreateJsTransformerCacheStore(cache.cachePath);
  const jsTransformerCache = new Cache<Uint8Array>(jsTransformerCacheStore, 'jstransformer');
  const jsTransformer = new JavaScriptTransformer(
    {
      sourcemap: !!sourcemapOptions.scripts,
      thirdPartySourcemaps: false,
      advancedOptimizations,
      jit: false,
    },
    1, // maxThreads - keep low for node_modules bundling
    jsTransformerCache
  );

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
      createAngularLinkerPlugin(jsTransformer, advancedOptimizations),
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

  const originalDispose = ctx.dispose.bind(ctx);
  ctx.dispose = async () => {
    await originalDispose();
    await jsTransformer.close();
  };

  return { ctx, pluginDisposed: Promise.resolve() };
}
