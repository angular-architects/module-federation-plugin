import * as fs from 'fs';
import * as path from 'path';
import {
  type NFBuildAdapter,
  type NFBuildAdapterResult,
  type NFBuildAdapterOptions,
  type FederationCache,
  type EntryPoint,
} from '@softarc/native-federation';
import { AbortedError, type MappedPath } from '@softarc/native-federation/internal';

import type * as esbuild from 'esbuild';
import type { SourceFileCache } from '@angular/build/private';
import type { BuilderContext } from '@angular-devkit/architect';
import type { ApplicationBuilderOptions } from '@angular/build';

import { createAngularEsbuildContext } from './angular-bundler.js';
import { createNodeModulesEsbuildContext } from './node-modules-bundler.js';

export interface EsbuildContextResult {
  ctx: esbuild.BuildContext;
  pluginDisposed: Promise<void>;
}

async function createEsbuildContext(
  builderOptions: ApplicationBuilderOptions,
  context: BuilderContext,
  entryPoints: EntryPoint[],
  external: string[],
  outdir: string,
  tsConfigPath: string,
  mappedPaths: MappedPath[],
  cache: FederationCache<SourceFileCache>,
  dev?: boolean,
  isNodeModules?: boolean,
  hash: boolean = false,
  chunks?: boolean,
  platform?: 'browser' | 'node',
  optimizedMappings?: boolean
): Promise<EsbuildContextResult> {
  if (isNodeModules) {
    return createNodeModulesEsbuildContext(
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
      platform
    );
  }

  return createAngularEsbuildContext(
    builderOptions,
    context,
    entryPoints,
    external,
    outdir,
    tsConfigPath,
    mappedPaths,
    cache,
    dev,
    hash,
    chunks,
    platform,
    optimizedMappings
  );
}

function writeResult(result: esbuild.BuildResult<esbuild.BuildOptions>, outdir: string): string[] {
  const writtenFiles: string[] = [];

  for (const outFile of result.outputFiles ?? []) {
    const fileName = path.basename(outFile.path);
    const filePath = path.join(outdir, fileName);
    fs.writeFileSync(filePath, outFile.text);
    writtenFiles.push(filePath);
  }

  return writtenFiles;
}

/**
 * Patches @angular/core to infer ngServerMode at runtime.
 * Usually, ngServerMode is set during bundling. However, we need to infer this
 * value at runtime as we are using the same shared bundle for @angular/core
 * on the server and in the browser.
 */
function setNgServerMode(): void {
  const fileToPatch = 'node_modules/@angular/core/fesm2022/core.mjs';
  const lineToAdd = `if (typeof globalThis.ngServerMode ==='undefined') globalThis.ngServerMode = (typeof window === 'undefined') ? true : false;`;

  try {
    if (fs.existsSync(fileToPatch)) {
      let content = fs.readFileSync(fileToPatch, 'utf-8');
      if (!content.includes(lineToAdd)) {
        content = lineToAdd + '\n' + content;
        fs.writeFileSync(fileToPatch, content);
      }
    }
  } catch {
    console.error('Error patching file ', fileToPatch, '\nIs it write-protected?');
  }
}

interface CachedBundleContext extends EsbuildContextResult {
  outdir: string;
  dev: boolean;
  name: string;
  cache: FederationCache<SourceFileCache>;
  isNodeModules: boolean;
}

export function createAngularBuildAdapter(
  builderOptions: ApplicationBuilderOptions,
  context: BuilderContext
): NFBuildAdapter {
  const bundleContextCache = new Map<string, CachedBundleContext>();

  const dispose = async (name?: string): Promise<void> => {
    if (name) {
      if (!bundleContextCache.has(name))
        throw new Error(`Could not dispose of non-existing build '${name}'`);
      const entry = bundleContextCache.get(name)!;

      await entry.ctx.dispose();
      await entry.pluginDisposed;
      bundleContextCache.delete(name);
      return;
    }

    const disposals: Promise<void>[] = [];

    for (const [, entry] of bundleContextCache) {
      disposals.push(
        (async () => {
          await entry.ctx.dispose();
          await entry.pluginDisposed;
        })()
      );
    }
    bundleContextCache.clear();
    await Promise.all(disposals);
  };

  const setup = async (options: NFBuildAdapterOptions<SourceFileCache>): Promise<void> => {
    const {
      entryPoints,
      tsConfigPath,
      external,
      outdir,
      mappedPaths,
      bundleName,
      isNodeModules,
      dev,
      chunks,
      hash,
      platform,
      optimizedMappings,
      cache,
    } = options;

    setNgServerMode();

    if (bundleContextCache.has(bundleName)) {
      return;
    }

    const { ctx, pluginDisposed } = await createEsbuildContext(
      builderOptions,
      context,
      entryPoints,
      external,
      outdir,
      tsConfigPath!,
      mappedPaths,
      cache,
      dev,
      isNodeModules,
      hash,
      chunks,
      platform,
      optimizedMappings
    );

    bundleContextCache.set(bundleName, {
      ctx,
      pluginDisposed,
      outdir,
      cache,
      isNodeModules,
      dev: !!dev,
      name: bundleName,
    });
  };

  const build = async (
    name: string,
    opts: {
      files?: string[];
      signal?: AbortSignal;
    } = {}
  ): Promise<NFBuildAdapterResult[]> => {
    const bundleContext = bundleContextCache.get(name);
    if (!bundleContext) {
      throw new Error(`No context found for build "${name}". Call setup() first.`);
    }

    if (opts?.signal?.aborted) {
      throw new AbortedError('[build] Aborted before rebuild');
    }

    try {
      if (opts.files) {
        bundleContext.cache.bundlerCache.invalidate(new Set(opts.files));
      }
      const result = await bundleContext.ctx.rebuild();
      const writtenFiles = writeResult(
        result as esbuild.BuildResult<esbuild.BuildOptions>,
        bundleContext.outdir
      );

      return writtenFiles.map(fileName => ({ fileName }) as NFBuildAdapterResult);
    } catch (error) {
      if (opts?.signal?.aborted && error instanceof Error && error.message.includes('canceled')) {
        throw new AbortedError('[build] ESBuild rebuild was canceled.');
      }
      throw error;
    }
  };

  return { setup, build, dispose };
}
