/* eslint-disable @nx/enforce-module-boundaries */
import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import { Schema } from '@angular-devkit/build-angular/src/builders/browser-esbuild/schema';
import { createI18nOptions } from '@angular-devkit/build-angular/src/utils/i18n-options';

import { buildEsbuildBrowser } from '@angular-devkit/build-angular/src/builders/browser-esbuild';

import * as path from 'path';
import { setLogLevel, logger } from '@softarc/native-federation/build';

import { FederationOptions } from '@softarc/native-federation/build';
import { setBuildAdapter } from '@softarc/native-federation/build';
import {
  createAngularBuildAdapter,
  setMemResultHandler,
} from '../../utils/angular-esbuild-adapter';
import { getExternals } from '@softarc/native-federation/build';
import { loadFederationConfig } from '@softarc/native-federation/build';
import { buildForFederation } from '@softarc/native-federation/build';
import { targetFromTargetString } from '@angular-devkit/architect';

import { NfBuilderSchema } from './schema';
import {
  reloadBrowser,
  reloadShell,
  setError,
  startServer,
} from '../../utils/dev-server';
import { RebuildHubs } from '../../utils/rebuild-events';
import { updateIndexHtml } from '../../utils/updateIndexHtml';
import { existsSync, mkdirSync, rmSync } from 'fs';
import {
  EsBuildResult,
  MemResults,
  NgCliAssetResult,
} from '../../utils/mem-resuts';
import { JsonObject } from '@angular-devkit/core';

export async function* runBuilder(
  nfOptions: NfBuilderSchema,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  const target = targetFromTargetString(nfOptions.target);
  const _options = (await context.getTargetOptions(
    target
  )) as unknown as JsonObject & Schema;

  const builder = await context.getBuilderNameForTarget(target);
  const options = (await context.validateOptions(
    _options,
    builder
  )) as JsonObject & Schema;
  const i18nOptions = createI18nOptions(await context.getProjectMetadata(target.project), options.localize);

  const runServer = !!nfOptions.port;
  const write = !runServer;
  const watch = !!runServer || nfOptions.watch;

  options.watch = watch;
  const rebuildEvents = new RebuildHubs();

  const adapter = createAngularBuildAdapter(options, context, rebuildEvents);
  setBuildAdapter(adapter);

  setLogLevel(options.verbose ? 'verbose' : 'info');

  const fedOptions: FederationOptions = {
    workspaceRoot: context.workspaceRoot,
    outputPath: options.outputPath,
    federationConfig: infereConfigPath(options.tsConfig),
    tsConfig: options.tsConfig,
    verbose: options.verbose,
    watch: false, // options.watch,
    dev: !!nfOptions.dev,
    locales: Array.from(i18nOptions.inlineLocales),
  };

  const config = await loadFederationConfig(fedOptions);
  const externals = getExternals(config);

  // options.externalDependencies = externals.filter((e) => e !== 'tslib');
  const plugins = [
    {
      name: 'externals',
      setup(build) {
        build.initialOptions.external = externals.filter((e) => e !== 'tslib');
      },
    },
  ];

  // for await (const r of buildEsbuildBrowser(options, context as any, { write: false })) {
  //   const output = r.outputFiles ||[];
  //   for (const o of output) {
  //     console.log('got', o.path);
  //   }
  // }
  // eslint-disable-next-line no-constant-condition
  // if (1===1) return;

  // const builderRun = await context.scheduleBuilder(
  //   '@angular-devkit/build-angular:browser-esbuild',
  //   options as any,
  //   { target }
  // );

  const memResults = new MemResults();

  let first = true;
  let lastResult: { success: boolean } | undefined;

  if (existsSync(options.outputPath)) {
    rmSync(options.outputPath, { recursive: true });
  }

  if (!existsSync(options.outputPath)) {
    mkdirSync(options.outputPath, { recursive: true });
  }

  if (!write) {
    setMemResultHandler((outFiles, outDir) => {
      const fullOutDir = outDir
        ? path.join(fedOptions.workspaceRoot, outDir)
        : null;
      memResults.add(outFiles.map((f) => new EsBuildResult(f, fullOutDir)));
    });
  }

  await buildForFederation(config, fedOptions, externals);

  options.deleteOutputPath = false;

  // builderRun.output.subscribe(async (output) => {
  for await (const output of buildEsbuildBrowser(
    options,
    context as any,
    {
      write,
    },
    plugins
  )) {
    lastResult = output;

    if (!output.success) {
      setError('Compilation Error');
      reloadBrowser();
      continue;
    } else {
      setError(null);
    }

    if (!write && output.outputFiles) {
      memResults.add(output.outputFiles.map((file) => new EsBuildResult(file)));
    }

    if (!write && output.assetFiles) {
      memResults.add(
        output.assetFiles.map((file) => new NgCliAssetResult(file))
      );
    }

    if (write) {
      updateIndexHtml(fedOptions);
    }

    if (first && runServer) {
      startServer(nfOptions, options.outputPath, memResults);
    }

    if (!first && runServer) {
      reloadBrowser();
    }

    if (!runServer) {
      yield output;
    }

    if (!first && watch) {
      setTimeout(async () => {
        // logger.info('Rebuilding federation artefacts ...');
        // await Promise.all([rebuildEvents.rebuild.emit()]);
        await buildForFederation(config, fedOptions, externals);
        logger.info('Done!');

        if (runServer) {
          setTimeout(() => reloadShell(nfOptions.shell), 0);
        }
      }, nfOptions.rebuildDelay);
    }

    first = false;
  }

  // updateIndexHtml(fedOptions);
  // const output = await lastValueFrom(builderRun.output as any);
  yield lastResult || { success: false };
}

export default createBuilder(runBuilder) as any;

function infereConfigPath(tsConfig: string): string {
  const relProjectPath = path.dirname(tsConfig);
  const relConfigPath = path.join(relProjectPath, 'federation.config.js');

  return relConfigPath;
}
