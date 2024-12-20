import {
  BuildAdapter,
  logger,
  MappedPath,
} from '@softarc/native-federation/build';

import * as esbuild from 'esbuild';

import {
  createCompilerPlugin,
  transformSupportedBrowsersToTargets,
  getSupportedBrowsers,
} from '@angular/build/private';

import { createCompilerPluginOptions } from './create-compiler-options';
import { BuilderContext } from '@angular-devkit/architect';
import { findTailwindConfigurationFile } from '@angular-devkit/build-angular/src/utils/tailwind';

import {
  normalizeOptimization,
  normalizeSourceMaps,
} from '@angular-devkit/build-angular/src/utils';
import { createRequire } from 'node:module';

import { ApplicationBuilderOptions } from '@angular/build';

import * as fs from 'fs';
import * as path from 'path';
import { createSharedMappingsPlugin } from './shared-mappings-plugin';

import { PluginItem, transformAsync } from '@babel/core';
import {
  BuildKind,
  BuildResult,
  EntryPoint,
} from '@softarc/native-federation/build';

import { RebuildEvents, RebuildHubs } from './rebuild-events';

import JSON5 from 'json5';
// import { ComponentStylesheetBundler } from '@angular/build/src/tools/esbuild/angular/component-stylesheets';

// const fesmFolderRegExp = /[/\\]fesm\d+[/\\]/;

export type MemResultHandler = (
  outfiles: esbuild.OutputFile[],
  outdir?: string
) => void;

let _memResultHandler: MemResultHandler;

export function setMemResultHandler(handler: MemResultHandler): void {
  _memResultHandler = handler;
}

export function createAngularBuildAdapter(
  builderOptions: ApplicationBuilderOptions,
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

    // TODO: Do we still need rollup as esbuilt evolved?
    // if (kind === 'shared-package') {
    //   await runRollup(entryPoint, external, outfile);
    // } else {

    //   if (
    //     dev &&
    //     kind === 'shared-package' &&
    //     entryPoint.match(fesmFolderRegExp)
    //   ) {
    //     fs.copyFileSync(entryPoint, outfile);
    //   } else {
    //     await runEsbuild(
    //       builderOptions,
    //       context,
    //       entryPoint,
    //       external,
    //       outfile,
    //       tsConfigPath,
    //       mappedPaths,
    //       watch,
    //       rebuildRequested,
    //       dev,
    //       kind
    //     );
    //   }
    //   if (kind === 'shared-package' && fs.existsSync(outfile)) {
    //     await link(outfile, dev);
    //   }
    // }
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
  builderOptions: ApplicationBuilderOptions,
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

  const commonjsPluginModule = await import('@chialab/esbuild-plugin-commonjs');
  const commonjsPlugin = commonjsPluginModule.default;

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
      commonjsPlugin(),
    ],
    define: {
      ...(!dev ? { ngDevMode: 'false' } : {}),
      ngJitMode: 'false',
    },
  };

  const ctx = await esbuild.context(config);
  const result = await ctx.rebuild();

  const memOnly = dev && kind === 'mapping-or-exposed' && !!_memResultHandler;

  const writtenFiles = writeResult(result, outdir, memOnly);

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

  // cleanUpTsConfigForFederation(tsConfigPath);

  return writtenFiles;
}

// function cleanUpTsConfigForFederation(tsConfigPath: string) {
//   if (tsConfigPath.includes('.federation.')) {
//     fs.unlinkSync(tsConfigPath);
//   }
// }

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
  // const tsconfigWithoutComments = tsconfigAsString.replace(
  //   /\/\*.+?\*\/|\/\/.*(?=[\n\r])/g,
  //   ''
  // );

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

  if (!doesFileExist(tsconfigFedPath, content)) {
    fs.writeFileSync(tsconfigFedPath, JSON.stringify(tsconfig, null, 2));
  }
  tsConfigPath = tsconfigFedPath;
  return tsConfigPath;
}

function doesFileExist(path: string, content: string): boolean {
  if (!fs.existsSync(path)) {
    return false;
  }
  const currentContent = fs.readFileSync(path, 'utf-8');
  return currentContent === content;
}

function writeResult(
  result: esbuild.BuildResult<esbuild.BuildOptions>,
  outdir: string,
  memOnly: boolean
) {
  const writtenFiles: string[] = [];

  if (memOnly) {
    _memResultHandler(result.outputFiles, outdir);
  }

  for (const outFile of result.outputFiles) {
    const fileName = path.basename(outFile.path);
    const filePath = path.join(outdir, fileName);
    if (!memOnly) {
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
      writeResult(result, outdir, memOnly);
    });
  }
}

export function loadEsmModule<T>(modulePath: string | URL): Promise<T> {
  return new Function('modulePath', `return import(modulePath);`)(
    modulePath
  ) as Promise<T>;
}
