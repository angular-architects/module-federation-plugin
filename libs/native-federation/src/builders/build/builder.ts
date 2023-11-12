/* eslint-disable @nx/enforce-module-boundaries */
import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import { Schema } from '@angular-devkit/build-angular/src/builders/application/schema';

import { buildEsbuildBrowser } from '@angular-devkit/build-angular/src/builders/browser-esbuild';

import { executeDevServerBuilder } from '@angular-devkit/build-angular/src/builders/dev-server';
import otag from 'observable-to-async-generator';

import {
  buildApplication,
  buildApplicationInternal,
} from '@angular-devkit/build-angular/src/builders/application';

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
import { existsSync, mkdirSync } from 'fs';
import {
  EsBuildResult,
  MemResults,
  NgCliAssetResult,
} from '../../utils/mem-resuts';
import { JsonObject } from '@angular-devkit/core';
import { observableToAsyncIterable } from '../../utils/observable-to-async-iterable';

export async function* runBuilder(
  nfOptions: NfBuilderSchema,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  const target = targetFromTargetString(nfOptions.target);
  const _options = (await context.getTargetOptions(
    target
  )) as unknown as JsonObject & Schema;

  const builder = await context.getBuilderNameForTarget(target);
  let options = (await context.validateOptions(
    _options,
    builder
  )) as JsonObject & Schema;

  const delegateOptions = options;

  if (options.buildTarget) {
    const appBuilderTarget = targetFromTargetString(
      options.buildTarget as string
    );
    options = (await context.getTargetOptions(
      appBuilderTarget
    )) as unknown as JsonObject & Schema;
  }

  // const runServer = !!nfOptions.port;
  // const write = !runServer;
  // const watch = !!runServer || nfOptions.watch;

  if (nfOptions.dev) {
    options.watch = true;
  }

  // TODO: Remove this!
  const rebuildEvents = new RebuildHubs();

  const adapter = createAngularBuildAdapter(options, context, rebuildEvents);
  setBuildAdapter(adapter);

  setLogLevel(options.verbose ? 'verbose' : 'info');

  const fedOptions: FederationOptions = {
    workspaceRoot: context.workspaceRoot,
    outputPath: path.join(options.outputPath, 'browser'),
    federationConfig: infereConfigPath(options.tsConfig),
    tsConfig: options.tsConfig,
    verbose: options.verbose,
    watch: !!nfOptions.dev,
    dev: !!nfOptions.dev,
  };

  const config = await loadFederationConfig(fedOptions);
  const externals = getExternals(config);

  // TODO: Find a way to delegate externals from dev-server to app builder
  //   (updating angular.json)?
  options.externalDependencies = externals.filter((e) => e !== 'tslib');

  if (fedOptions.dev) {
    delegateOptions.open = true;
    delegateOptions['live-reload'] = true;
  }

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

  // const memResults = new MemResults();

  let first = true;
  let lastResult: { success: boolean } | undefined;

  if (!existsSync(options.outputPath)) {
    mkdirSync(options.outputPath, { recursive: true });
  }

  // if (!write) {
  //   setMemResultHandler((outFiles) => {
  //     memResults.add(outFiles.map((f) => new EsBuildResult(f)));
  //   });
  // }

  // const logger = context.logger.createChild('inner');

  // context.scheduleTarget()
  // for await (const x of context.scheduleBuilder(builder, options, {  logger })) {

  // }
  // builderRun.output.subscribe(async (output) => {

  await buildForFederation(config, fedOptions, externals);

  const builderResult = nfOptions.dev
    ? otag(executeDevServerBuilder(delegateOptions, context as any))
    : buildApplicationInternal(delegateOptions, context as any, undefined);

  // for await (const output of buildApplicationInternal(options, context as any)) {
  for await (const output of builderResult) {
    lastResult = output;

    if (!output.success) {
      setError('Compilation Error');
      // reloadBrowser();
      continue;
    } else {
      setError(null);
    }

    // if (!write && output.outputFiles) {
    //   memResults.add(output.outputFiles.map((file) => new EsBuildResult(file)));
    // }

    // if (!write && output.assetFiles) {
    //   memResults.add(
    //     output.assetFiles.map((file) => new NgCliAssetResult(file))
    //   );
    // }

    // if (write) {
    if (!fedOptions.dev) {
      updateIndexHtml(fedOptions);
    }
    // }

    // if (first && runServer) {
    //   startServer(nfOptions, options.outputPath, memResults);
    // }

    // if (!first && runServer) {
    //   reloadBrowser();
    // }

    // if (!runServer) {
    yield output;
    // }

    if (!first && fedOptions.dev) {
      setTimeout(async () => {
        logger.info('Rebuilding federation artefacts ...');
        await Promise.all([rebuildEvents.rebuild.emit()]);
        logger.info('Done!');

        // if (runServer) {
        //   setTimeout(() => reloadShell(nfOptions.shell), 0);
        // }
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
