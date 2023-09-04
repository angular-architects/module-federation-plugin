import {
  BuildAdapter,
  logger,
  MappedPath,
} from '@softarc/native-federation/build';
import * as esbuild from 'esbuild';
import { createCompilerPlugin } from '@angular-devkit/build-angular/src/tools/esbuild/angular/compiler-plugin';

import { BuilderContext } from '@angular-devkit/architect';

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

// const fesmFolderRegExp = /[/\\]fesm\d+[/\\]/;

export function createAngularBuildAdapter(
  builderOptions: EsBuildBuilderOptions,
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
  builderOptions: EsBuildBuilderOptions,
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
    platform: 'browser',
    format: 'esm',
    target: ['esnext'],
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
  const writtenFiles = writeResult(result, outdir);

  if (watch) {
    registerForRebuilds(kind, rebuildRequested, ctx, entryPoints, outdir, hash);
  } else {
    ctx.dispose();
  }

  return writtenFiles;
}

function writeResult(
  result: esbuild.BuildResult<esbuild.BuildOptions>,
  outdir: string
) {
  const writtenFiles: string[] = [];
  for (const outFile of result.outputFiles) {
    const fileName = path.basename(outFile.path);
    const filePath = path.join(outdir, fileName);
    fs.writeFileSync(filePath, outFile.text);
    writtenFiles.push(filePath);
  }

  return writtenFiles;
}

function registerForRebuilds(
  kind: BuildKind,
  rebuildRequested: RebuildEvents,
  ctx: esbuild.BuildContext<esbuild.BuildOptions>,
  entryPoints: EntryPoint[],
  outdir: string,
  hash: boolean
) {
  if (kind !== 'shared-package') {
    rebuildRequested.rebuild.register(async () => {
      const result = await ctx.rebuild();
      writeResult(result, outdir);
    });
  }
}

export function loadEsmModule<T>(modulePath: string | URL): Promise<T> {
  return new Function('modulePath', `return import(modulePath);`)(
    modulePath
  ) as Promise<T>;
}
