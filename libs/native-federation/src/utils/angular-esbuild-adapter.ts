import {
  BuildAdapter,
  logger,
  MappedPath,
} from '@softarc/native-federation/build';
import * as esbuild from 'esbuild';
import { createCompilerPlugin } from '@angular-devkit/build-angular/src/tools/esbuild/angular/compiler-plugin';

import { BuilderContext, BuilderOutput } from '@angular-devkit/architect';

import { transformSupportedBrowsersToTargets } from './transform';

// TODO: Use this import instead in next version:
// import {
//   transformSupportedBrowsersToTargets
// } from '@angular-devkit/build-angular/src/tools/esbuild/utils';

import { createCompilerPluginOptions } from '@angular-devkit/build-angular/src/tools/esbuild/compiler-plugin-options';

import { findTailwindConfigurationFile } from '@angular-devkit/build-angular/src/utils/tailwind';

import { getSupportedBrowsers } from '@angular-devkit/build-angular/src/utils/supported-browsers';
import {
  normalizeOptimization,
  normalizeSourceMaps,
} from '@angular-devkit/build-angular/src/utils';
import { createRequire } from 'node:module';

import { Schema as EsBuildBuilderOptions } from '@angular-devkit/build-angular/src/builders/browser-esbuild/schema';
import {
  ApplicationBuilderOptions as AppBuilderSchema,
  buildApplicationInternal,
} from '@angular-devkit/build-angular/src/builders/application';

import { createSharedMappingsPlugin } from './shared-mappings-plugin';
import * as fs from 'fs';
import * as path from 'path';

import { PluginItem, transformAsync } from '@babel/core';
import { RebuildEvents, RebuildHubs } from './rebuild-events';
import {
  BuildKind,
  BuildResult,
  EntryPoint,
} from 'libs/native-federation-core/src/lib/core/build-adapter';
import { ApplicationBuilderInternalOptions } from '@angular-devkit/build-angular/src/builders/application/options';
import { OutputHashing } from '@angular-devkit/build-angular';
import { BuildOutputFile } from '@angular-devkit/build-angular/src/tools/esbuild/bundler-context';

// const fesmFolderRegExp = /[/\\]fesm\d+[/\\]/;

export type MemResultHandler = (
  outfiles: esbuild.OutputFile[],
  outdir?: string
) => void;

let _memResultHandler: MemResultHandler;

export function setMemResultHandler(handler: MemResultHandler): void {
  _memResultHandler = handler;
}

export type AngularBuildOutput = BuilderOutput & {
  outputFiles?: BuildOutputFile[];
  assetFiles?: { source: string; destination: string }[];
};

export function createAngularBuildAdapter(
  builderOptions: AppBuilderSchema,
  context: BuilderContext,
  rebuildRequested: RebuildEvents = new RebuildHubs()
): BuildAdapter {
  return async (options) => {
    const {
      entryPoints,
      tsConfigPath,
      external,
      outdir,
      mappedPaths,
      kind,
      watch,
      dev,
      hash,
    } = options;

    if (kind.includes('shared')) {
      const files = await runEsbuild(
        builderOptions,
        context,
        entryPoints,
        external,
        outdir,
        tsConfigPath,
        mappedPaths,
        watch,
        rebuildRequested,
        dev,
        kind,
        hash
      );

      if (kind === 'shared-package') {
        const scriptFiles = files.filter(
          (f) => f.endsWith('.js') || f.endsWith('.mjs')
        );
        for (const file of scriptFiles) {
          link(file, dev);
        }
      }

      return files.map((fileName) => ({ fileName } as BuildResult));
    } else {
      return await runNgBuild(
        builderOptions,
        context,
        entryPoints,
        external,
        outdir,
        tsConfigPath,
        mappedPaths,
        watch,
        rebuildRequested,
        dev,
        kind,
        hash
      );
    }
  };

  async function link(outfile: string, dev: boolean) {
    const code = fs.readFileSync(outfile, 'utf-8');

    try {
      const linkerEsm = await loadEsmModule<{ default: PluginItem }>(
        '@angular/compiler-cli/linker/babel'
      );

      const linker = linkerEsm.default;

      const result = await transformAsync(code, {
        filename: outfile,
        // inputSourceMap: (useInputSourcemap ? undefined : false) as undefined,
        // sourceMaps: pluginOptions.sourcemap ? 'inline' : false,
        compact: !dev,
        configFile: false,
        babelrc: false,
        minified: !dev,
        browserslistConfigFile: false,
        plugins: [linker],
      });

      fs.writeFileSync(outfile, result.code, 'utf-8');
    } catch (e) {
      logger.error('error linking');

      if (fs.existsSync(`${outfile}.error`)) {
        fs.unlinkSync(`${outfile}.error`);
      }
      fs.renameSync(outfile, `${outfile}.error`);

      throw e;
    }
  }
}

async function runEsbuild(
  builderOptions: AppBuilderSchema,
  context: BuilderContext,
  entryPoints: EntryPoint[],
  external: string[],
  outdir: string,
  tsConfigPath: string,
  mappedPaths: MappedPath[],
  watch?: boolean,
  rebuildRequested: RebuildEvents = new RebuildHubs(),
  dev?: boolean,
  kind?: BuildKind,
  hash = false,
  plugins: esbuild.Plugin[] | null = null,
  absWorkingDir: string | undefined = undefined,
  logLevel: esbuild.LogLevel = 'warning'
) {
  const projectRoot = path.dirname(tsConfigPath);
  const browsers = getSupportedBrowsers(projectRoot, context.logger as any);
  const target = transformSupportedBrowsersToTargets(browsers);

  const workspaceRoot = context.workspaceRoot;

  const optimizationOptions = normalizeOptimization(
    builderOptions.optimization
  );
  const sourcemapOptions = normalizeSourceMaps(builderOptions.sourceMap);
  const tailwindConfigurationPath = await findTailwindConfigurationFile(
    workspaceRoot,
    projectRoot
  );

  const fullProjectRoot = path.join(workspaceRoot, projectRoot);
  const resolver = createRequire(fullProjectRoot + '/');

  const tailwindConfiguration = tailwindConfigurationPath
    ? {
        file: tailwindConfigurationPath,
        package: resolver.resolve('tailwindcss'),
      }
    : undefined;

  const outputNames = {
    bundles: '[name]',
    media: 'media/[name]',
  };

  let fileReplacements: Record<string, string> | undefined;
  if (builderOptions.fileReplacements) {
    for (const replacement of builderOptions.fileReplacements) {
      fileReplacements ??= {};
      fileReplacements[path.join(workspaceRoot, replacement.replace)] =
        path.join(workspaceRoot, replacement.with);
    }
  }

  tsConfigPath = createTsConfigForFederation(
    workspaceRoot,
    tsConfigPath,
    entryPoints
  );

  const pluginOptions = createCompilerPluginOptions(
    {
      workspaceRoot,
      optimizationOptions,
      sourcemapOptions,
      tsconfig: tsConfigPath,
      outputNames,
      fileReplacements,
      externalDependencies: external,
      preserveSymlinks: builderOptions.preserveSymlinks,
      stylePreprocessorOptions: builderOptions.stylePreprocessorOptions,
      advancedOptimizations: !dev,
      inlineStyleLanguage: builderOptions.inlineStyleLanguage,
      jit: false,
      tailwindConfiguration,
    } as any,
    target,
    undefined
  );

  pluginOptions.styleOptions.externalDependencies = [];

  const config: esbuild.BuildOptions = {
    entryPoints: entryPoints.map((ep) => ({
      in: ep.fileName,
      out: path.parse(ep.outName).name,
    })),
    outdir,
    entryNames: hash ? '[name]-[hash]' : '[name]',
    write: false,
    absWorkingDir,
    external,
    logLevel,
    bundle: true,
    sourcemap: dev,
    minify: !dev,
    supported: {
      'async-await': false,
      'object-rest-spread': false,
    },
    splitting: kind === 'mapping-or-exposed',
    platform: 'browser',
    format: 'esm',
    target: ['esnext'],
    logLimit: kind === 'shared-package' ? 1 : 0,
    plugins: plugins || [
      createCompilerPlugin(
        pluginOptions.pluginOptions,
        pluginOptions.styleOptions

        // TODO: Once available, use helper functions
        //  for creating these config objects:
        //  @angular_devkit/build_angular/src/tools/esbuild/compiler-plugin-options.ts
        // {
        //   jit: false,
        //   sourcemap: dev,
        //   tsconfig: tsConfigPath,
        //   advancedOptimizations: !dev,
        //   thirdPartySourcemaps: false,
        // },
        // {
        //   optimization: !dev,
        //   sourcemap: dev ? 'inline' : false,
        //   workspaceRoot: __dirname,
        //   inlineStyleLanguage: builderOptions.inlineStyleLanguage,
        //   // browsers: browsers,

        //   target: target,
        // }
      ),
      ...(mappedPaths && mappedPaths.length > 0
        ? [createSharedMappingsPlugin(mappedPaths)]
        : []),
    ],
    define: {
      ...(!dev ? { ngDevMode: 'false' } : {}),
      ngJitMode: 'false',
    },
  };

  const ctx = await esbuild.context(config);
  const result = await ctx.rebuild();
  // always false
  const memOnly = dev && kind === 'mapping-or-exposed' && !!_memResultHandler;

  const writtenFiles = writeResult(result, outdir, memOnly, kind);

  if (watch) {
    registerForRebuilds(
      kind,
      rebuildRequested,
      ctx,
      entryPoints,
      outdir,
      hash,
      memOnly
    );
  } else {
    ctx.dispose();
  }

  cleanUpTsConfigForFederation(tsConfigPath);

  return writtenFiles;
}

function cleanUpTsConfigForFederation(tsConfigPath: string) {
  if (tsConfigPath.includes('.federation.')) {
    fs.unlinkSync(tsConfigPath);
  }
}

function createTsConfigForFederation(
  workspaceRoot: string,
  tsConfigPath: string,
  entryPoints: EntryPoint[]
) {
  const fullTsConfigPath = path.join(workspaceRoot, tsConfigPath);
  const tsconfigDir = path.dirname(fullTsConfigPath);

  const filtered = entryPoints
    .filter(
      (ep) =>
        !ep.fileName.includes('/node_modules/') && !ep.fileName.startsWith('.')
    )
    .map((ep) => path.relative(tsconfigDir, ep.fileName).replace(/\\\\/g, '/'));

  const tsconfigAsString = fs.readFileSync(fullTsConfigPath, 'utf-8');
  const tsconfigWithoutComments = tsconfigAsString.replace(
    /\/\*.+?\*\/|\/\/.*(?=[\n\r])/g,
    ''
  );
  const tsconfig = JSON.parse(tsconfigWithoutComments);

  if (!tsconfig.include) {
    tsconfig.include = [];
  }

  for (const ep of filtered) {
    if (!tsconfig.include.includes(ep)) {
      tsconfig.include.push(ep);
    }
  }

  const tsconfigFedPath = path.join(tsconfigDir, 'tsconfig.federation.json');
  fs.writeFileSync(tsconfigFedPath, JSON.stringify(tsconfig, null, 2));
  tsConfigPath = tsconfigFedPath;
  return tsConfigPath;
}

function writeResult(
  result: Pick<esbuild.BuildResult<esbuild.BuildOptions>, 'outputFiles'>,
  outdir: string,
  memOnly: boolean,
  kind: BuildKind
) {
  const writtenFiles: string[] = [];

  if (memOnly) {
    _memResultHandler(result.outputFiles, outdir);
  }

  const directoryExists = new Set<string>();
  const ensureDirectoryExists = (basePath: string) => {
    if (basePath && !directoryExists.has(basePath)) {
      fs.mkdirSync(path.join(outdir, basePath), { recursive: true });
      directoryExists.add(basePath);
    }
  };
  for (const outFile of result.outputFiles) {
    const fileName =
      kind != 'mapping-or-exposed' ? path.basename(outFile.path) : outFile.path;
    const filePath = path.join(outdir, fileName);
    if (!memOnly) {
      ensureDirectoryExists(path.dirname(fileName));
      fs.writeFileSync(filePath, outFile.text);
    }
    writtenFiles.push(filePath);
  }

  if (!memOnly) {
    // for (const asset of result.outputFiles)
  }

  return writtenFiles;
}

function registerForRebuilds(
  kind: BuildKind,
  rebuildRequested: RebuildEvents,
  ctx: esbuild.BuildContext<esbuild.BuildOptions>,
  entryPoints: EntryPoint[],
  outdir: string,
  hash: boolean,
  memOnly: boolean
) {
  if (kind !== 'shared-package') {
    rebuildRequested.rebuild.register(async () => {
      const result = await ctx.rebuild();
      writeResult(result, outdir, memOnly, kind);
    });
  }
}

export function loadEsmModule<T>(modulePath: string | URL): Promise<T> {
  return new Function('modulePath', `return import(modulePath);`)(
    modulePath
  ) as Promise<T>;
}

async function runNgBuild(
  builderOptions: AppBuilderSchema,
  context: BuilderContext,
  entryPoints: EntryPoint[],
  external: string[],
  outdir: string,
  tsConfigPath: string,
  mappedPaths: MappedPath[],
  watch?: boolean,
  rebuildRequested: RebuildEvents = new RebuildHubs(),
  dev?: boolean,
  kind?: BuildKind,
  hash = false,
  plugins: esbuild.Plugin[] | null = null,
  absWorkingDir: string | undefined = undefined,
  logLevel: esbuild.LogLevel = 'warning'
): Promise<BuildResult[]> {
  if (!entryPoints.length) {
    return Promise.resolve([]);
  }
  // unfortunately angular doesn't let us specify the out name of the enties. We'll have to map file names post-build.
  const entries = new Set<string>();
  for (const entryPoint of entryPoints) {
    entries.add(entryPoint.fileName);
  }
  // if watch stays enabled then the build will hang at this point...
  // watching build of exposed entries may not be necessary, because you host the app including any exposed things (if reachable)
  const builderOpts: ApplicationBuilderInternalOptions = {
    ...builderOptions,
    watch: false,
    entryPoints: entries,
    outputHashing: hash ? OutputHashing.Bundles : OutputHashing.None,
    externalDependencies: [
      ...builderOptions.externalDependencies,
      ...external,
    ].filter((e) => e !== 'tslib'),
  };
  if (builderOpts.browser) {
    // we're specifying entries instead of browser
    delete builderOpts.browser;
  }

  const inputPlugins = [
    ...(plugins ?? []),
    createSharedMappingsPlugin(mappedPaths),
    {
      name: 'fixSplitting',
      setup(build: esbuild.PluginBuild) {
        build.initialOptions.splitting = false;
        build.initialOptions.chunkNames = '';
      },
    },
  ];

  const memOnly = dev && kind === 'mapping-or-exposed' && !!_memResultHandler;

  async function run(): Promise<BuildResult[]> {
    const builderRun = await buildApplicationInternal(
      builderOpts,
      context,
      { write: false },
      inputPlugins
    );
    let output: AngularBuildOutput;
    for await (output of builderRun) {
      if (!output.success) {
        logger.error('Building exposed entries failed with: ' + output.error);
        throw new Error('Native federation failed building exposed entries');
      }
      // we were not able to tell angular builder that we expected the entrypoint's out name to be different
      // therefore we must try and map files back, and do the transformation ourselves, when applicable.
      for (const outFile of output.outputFiles) {
        const pathBasename = path.basename(outFile.path);
        const name = path.parse(
          pathBasename.replace(/(?:-[\dA-Z]{8})?(\.[a-z]{2,3})$/, '$1')
        ).name;
        const entry = entryPoints.find(
          (ep) => path.parse(ep.fileName).name == name
        );
        if (entry) {
          const nameHash = hash
            ? pathBasename.substring(
                pathBasename.lastIndexOf('-'),
                pathBasename.lastIndexOf('.')
              )
            : '';
          const originalOutName = entry.outName.substring(
            0,
            entry.outName.lastIndexOf('.')
          );
          outFile.path = path.join(
            path.dirname(outFile.path),
            originalOutName + nameHash + '.js'
          );
        }
      }
    }
    // output's outFiles is marked optional. The Angular types aren't helping us here, but we know it's there
    const writtenFiles = writeResult(output as any, outdir, memOnly, kind);
    return writtenFiles.map((file) => ({ fileName: file }));
  }
  rebuildRequested.rebuild.register(async () => {
    await run();
  });
  return run();
}
