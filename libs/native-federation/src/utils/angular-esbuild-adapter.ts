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

import { getSupportedBrowsers } from '@angular-devkit/build-angular/src/utils/supported-browsers';

import { Schema as EsBuildBuilderOptions } from '@angular-devkit/build-angular/src/builders/browser-esbuild/schema';

import { createSharedMappingsPlugin } from './shared-mappings-plugin';
import * as fs from 'fs';
import * as path from 'path';

import { PluginItem, transformAsync } from '@babel/core';
import { RebuildEvents, RebuildHubs } from './rebuild-events';
import { BuildKind } from 'libs/native-federation-core/src/lib/core/build-adapter';

const fesmFolderRegExp = /[/\\]fesm\d+[/\\]/;

export function createAngularBuildAdapter(
  builderOptions: EsBuildBuilderOptions,
  context: BuilderContext,
  rebuildRequested: RebuildEvents = new RebuildHubs()
): BuildAdapter {
  return async (options) => {
    const {
      entryPoint,
      tsConfigPath,
      external,
      outfile,
      mappedPaths,
      kind,
      watch,
      dev,
    } = options;

    // TODO: Do we still need rollup as esbuilt evolved?
    // if (kind === 'shared-package') {
    //   await runRollup(entryPoint, external, outfile);
    // } else {
    if (
      dev &&
      kind === 'shared-package' &&
      entryPoint.match(fesmFolderRegExp)
    ) {
      fs.copyFileSync(entryPoint, outfile);
    } else {
      await runEsbuild(
        builderOptions,
        context,
        entryPoint,
        external,
        outfile,
        tsConfigPath,
        mappedPaths,
        watch,
        rebuildRequested,
        dev,
        kind
      );
    }
    if (kind === 'shared-package' && fs.existsSync(outfile)) {
      await link(outfile, dev);
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
  builderOptions: EsBuildBuilderOptions,
  context: BuilderContext,
  entryPoint: string,
  external: string[],
  outfile: string,
  tsConfigPath: string,
  mappedPaths: MappedPath[],
  watch?: boolean,
  rebuildRequested: RebuildEvents = new RebuildHubs(),
  dev?: boolean,
  kind?: BuildKind,
  plugins: esbuild.Plugin[] | null = null,
  absWorkingDir: string | undefined = undefined,
  logLevel: esbuild.LogLevel = 'warning'
) {
  const projectRoot = path.dirname(tsConfigPath);
  const browsers = getSupportedBrowsers(projectRoot, context.logger as any);
  const target = transformSupportedBrowsersToTargets(browsers);

  const config: esbuild.BuildOptions = {
    entryPoints: [entryPoint],
    absWorkingDir,
    external,
    outfile,
    logLevel,
    bundle: true,
    sourcemap: dev,
    minify: !dev,
    platform: 'browser',
    format: 'esm',
    target: ['esnext'],
    plugins: plugins || [
      createCompilerPlugin(
        // TODO: Once available, use helper functions
        //  for creating these config objects:
        //  packages/angular_devkit/build_angular/src/tools/esbuild/compiler-plugin-options.ts
        {
          jit: false,
          sourcemap: dev,
          tsconfig: tsConfigPath,
          advancedOptimizations: !dev,
          thirdPartySourcemaps: false,
        },
        {
          optimization: !dev,
          sourcemap: dev ? 'inline' : false,
          workspaceRoot: __dirname,
          inlineStyleLanguage: builderOptions.inlineStyleLanguage,
          browsers: browsers,
          target: target,
        }
      ),
      ...(mappedPaths && mappedPaths.length > 0
        ? [createSharedMappingsPlugin(mappedPaths)]
        : []),
    ],
    define: {
      ngDevMode: dev ? 'true' : 'false',
      ngJitMode: 'false',
    },
  };

  if (watch) {
    const ctx = await esbuild.context(config);
    await ctx.rebuild();
    registerForRebuilds(kind, rebuildRequested, ctx);
  } else {
    await esbuild.build(config);
  }
}

function registerForRebuilds(
  kind: string,
  rebuildRequested: RebuildEvents,
  ctx: esbuild.BuildContext<esbuild.BuildOptions>
) {
  if (kind === 'exposed') {
    rebuildRequested.rebuildExposed.register(async () => {
      await ctx.rebuild();
    });
  } else if (kind === 'shared-mapping') {
    rebuildRequested.rebuildMappings.register(async () => {
      await ctx.rebuild();
    });
  }
}

export function loadEsmModule<T>(modulePath: string | URL): Promise<T> {
  return new Function('modulePath', `return import(modulePath);`)(
    modulePath
  ) as Promise<T>;
}
