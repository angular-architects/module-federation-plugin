import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import JSON5 from 'json5';

import {
  transformSupportedBrowsersToTargets,
  getSupportedBrowsers,
  generateSearchDirectories,
  findTailwindConfiguration,
  loadPostcssConfiguration,
  type SourceFileCache,
  type BundleStylesheetOptions,
  type CompilerPluginOptions,
} from '@angular/build/private';

import type { BuilderContext } from '@angular-devkit/architect';

import {
  normalizeOptimization,
  normalizeSourceMaps,
} from '@angular-devkit/build-angular/src/utils/index.js';

import type { ApplicationBuilderOptions } from '@angular/build';
import type { EntryPoint, FederationCache } from '@softarc/native-federation';
import type { MappedPath } from '@softarc/native-federation/internal';

import { createSharedMappingsPlugin } from './shared-mappings-plugin.js';
import { createAwaitableCompilerPlugin } from './create-awaitable-compiler-plugin.js';

export interface AngularBundleResult {
  ctx: esbuild.BuildContext;
  pluginDisposed: Promise<void>;
}

/**
 * Full Angular esbuild context for bundling source code (exposed modules, shared mappings).
 * Uses the Angular compiler plugin for TypeScript and template compilation.
 */
export async function createAngularEsbuildContext(
  builderOptions: ApplicationBuilderOptions,
  context: BuilderContext,
  entryPoints: EntryPoint[],
  external: string[],
  outdir: string,
  tsConfigPath: string,
  mappedPaths: MappedPath[],
  cache: FederationCache<SourceFileCache>,
  dev?: boolean,
  hash: boolean = false,
  chunks?: boolean,
  platform?: 'browser' | 'node',
  optimizedMappings?: boolean
): Promise<AngularBundleResult> {
  const workspaceRoot = context.workspaceRoot;

  const projectMetadata = await context.getProjectMetadata(context.target!.project);
  const projectRoot = path.join(
    workspaceRoot,
    (projectMetadata['root'] as string | undefined) ?? ''
  );

  const browsers = getSupportedBrowsers(projectRoot, context.logger as unknown as Console);
  const target = transformSupportedBrowsersToTargets(browsers);

  const optimizationOptions = normalizeOptimization(builderOptions.optimization);
  const sourcemapOptions = normalizeSourceMaps(builderOptions.sourceMap!);

  const searchDirectories = await generateSearchDirectories([projectRoot, workspaceRoot]);
  const postcssConfiguration = await loadPostcssConfiguration(searchDirectories);
  const tailwindConfiguration = postcssConfiguration
    ? undefined
    : await getTailwindConfig(searchDirectories);

  const outputNames = {
    bundles: '[name]',
    media: 'media/[name]',
  };

  let fileReplacements: Record<string, string> | undefined;
  if (builderOptions.fileReplacements) {
    for (const replacement of builderOptions.fileReplacements) {
      fileReplacements ??= {};
      fileReplacements[path.join(workspaceRoot, replacement.replace)] = path.join(
        workspaceRoot,
        replacement.with
      );
    }
  }

  if (!optimizedMappings) {
    tsConfigPath = createTsConfigForFederation(workspaceRoot, tsConfigPath, entryPoints);
  }

  const pluginOptions: CompilerPluginOptions = {
    sourcemap: !!sourcemapOptions.scripts && (sourcemapOptions.hidden ? 'external' : true),
    thirdPartySourcemaps: sourcemapOptions.vendor,
    tsconfig: tsConfigPath,
    jit: false,
    advancedOptimizations: !dev,
    fileReplacements,
    sourceFileCache: cache.bundlerCache,
    loadResultCache: cache.bundlerCache.loadResultCache,
    incremental: true,
    includeTestMetadata: !optimizationOptions.scripts,
  };

  const stylesheetBundlerOptions: BundleStylesheetOptions & { inlineStyleLanguage: string } = {
    workspaceRoot,
    inlineFonts: !!optimizationOptions.fonts.inline,
    optimization: !!optimizationOptions.styles.minify,
    sourcemap:
      // Hidden component stylesheet sourcemaps are inaccessible which is effectively
      // the same as being disabled. Disabling has the advantage of avoiding the overhead
      // of sourcemap processing.
      sourcemapOptions.styles && !sourcemapOptions.hidden ? 'linked' : false,
    outputNames,
    includePaths: builderOptions.stylePreprocessorOptions?.includePaths,
    sass: builderOptions?.stylePreprocessorOptions?.sass as BundleStylesheetOptions['sass'],
    externalDependencies: external,
    target,
    inlineStyleLanguage: builderOptions.inlineStyleLanguage ?? 'css',
    preserveSymlinks: builderOptions.preserveSymlinks,
    tailwindConfiguration,
    postcssConfiguration,
    cacheOptions: {
      enabled: true,
      basePath: cache.cachePath,
      path: cache.cachePath,
    },
  };

  const commonjsPluginModule = await import('@chialab/esbuild-plugin-commonjs');
  const commonjsPlugin = commonjsPluginModule.default;

  stylesheetBundlerOptions.externalDependencies = [];

  const [compilerPlugin, pluginDisposed] = createAwaitableCompilerPlugin(
    pluginOptions,
    stylesheetBundlerOptions
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
    logLimit: 0,
    plugins: [
      compilerPlugin,
      ...(mappedPaths && mappedPaths.length > 0 ? [createSharedMappingsPlugin(mappedPaths)] : []),
      commonjsPlugin(),
    ],
    define: {
      ...(!dev ? { ngDevMode: 'false' } : {}),
      ngJitMode: 'false',
    },
    ...(builderOptions.loader ? { loader: builderOptions.loader } : {}),
    resolveExtensions: ['.ts', '.tsx', '.mjs', '.js', '.cjs'],
  };

  const ctx = await esbuild.context(config);

  return { ctx, pluginDisposed };
}

async function getTailwindConfig(
  searchDirectories: { root: string; files: Set<string> }[]
): Promise<{ file: string; package: string } | undefined> {
  const tailwindConfigurationPath = findTailwindConfiguration(searchDirectories);

  if (!tailwindConfigurationPath) {
    return undefined;
  }

  return {
    file: tailwindConfigurationPath,
    package: createRequire(tailwindConfigurationPath).resolve('tailwindcss'),
  };
}

/**
 * Creates a tsconfig.federation.json that includes the federation entry points.
 */
function createTsConfigForFederation(
  workspaceRoot: string,
  tsConfigPath: string,
  entryPoints: EntryPoint[]
): string {
  const fullTsConfigPath = path.join(workspaceRoot, tsConfigPath);
  const tsconfigDir = path.dirname(fullTsConfigPath);

  const filtered = entryPoints
    .filter(ep => !ep.fileName.includes('/node_modules/') && !ep.fileName.startsWith('.'))
    .map(ep => path.relative(tsconfigDir, ep.fileName).replace(/\\\\/g, '/'));

  const tsconfigAsString = fs.readFileSync(fullTsConfigPath, 'utf-8');
  const tsconfig = JSON5.parse(tsconfigAsString);

  if (!tsconfig.include) {
    tsconfig.include = [];
  }

  for (const ep of filtered) {
    if (!tsconfig.include.includes(ep)) {
      tsconfig.include.push(ep);
    }
  }

  const content = JSON5.stringify(tsconfig, null, 2);

  const tsconfigFedPath = path.join(tsconfigDir, 'tsconfig.federation.json');

  if (!doesFileExistAndJsonEqual(tsconfigFedPath, content)) {
    fs.writeFileSync(tsconfigFedPath, JSON.stringify(tsconfig, null, 2));
  }

  return tsconfigFedPath;
}

function doesFileExistAndJsonEqual(filePath: string, content: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    const currentContent = fs.readFileSync(filePath, 'utf-8');
    const currentJson = JSON5.parse(currentContent);
    const newJson = JSON5.parse(content);

    return isDeepStrictEqual(currentJson, newJson);
  } catch {
    return false;
  }
}
