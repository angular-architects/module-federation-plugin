import * as path from 'path';

import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import { Schema } from '@angular-devkit/build-angular/src/builders/application/schema';

import { buildApplication } from '@angular-devkit/build-angular/src/builders/application';

import { serveWithVite } from '@angular-devkit/build-angular/src/builders/dev-server/vite-server';
import { DevServerBuilderOptions } from '@angular-devkit/build-angular/src/builders/dev-server';
import { normalizeOptions } from '@angular-devkit/build-angular/src/builders/dev-server/options';

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
import { existsSync, mkdirSync, rmSync } from 'fs';
import {
  EsBuildResult,
  MemResults,
  NgCliAssetResult,
} from '../../utils/mem-resuts';
import { JsonObject } from '@angular-devkit/core';
import { createSharedMappingsPlugin } from '../../utils/shared-mappings-plugin';
import { PluginBuild } from 'esbuild';
import { prepareBundles } from '../../utils/prepare-bundles';
import { updateScriptTags } from '../../utils/updateIndexHtml';
import { createI18nOptions } from '@angular-devkit/build-angular/src/utils/i18n-options';
import { getFederationFilesMiddleware } from '../../utils/federation-files-middleware';

export async function* runBuilder(
  nfOptions: NfBuilderSchema,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  let target = targetFromTargetString(nfOptions.target);

  let _options = (await context.getTargetOptions(
    target
  )) as unknown as JsonObject & Schema;

  let builder = await context.getBuilderNameForTarget(target);

  if (builder === '@angular-devkit/build-angular:browser-esbuild') {
    logger.info('.: NATIVE FEDERATION - UPDATE NEEDED :.');
    logger.info('');
    logger.info("Since version 17.1, Native Federation uses Angular's");
    logger.info('Application-Builder and its Dev-Server.');
    logger.info('');
    logger.info('If you are sill on Angular 17.0.x, please update to');
    logger.info('Angular 17.1.x or downgrade to Native Federation 17.0.x.');
    logger.info('');
    logger.info('For working with Native Federation 17.1.x (recommented), ');
    logger.info('please update your project config, e.g. in angular.json');
    logger.info('');
    logger.info('This command performs the needed update for default configs:');
    logger.info('');
    logger.info('\tng g @angular-architects/native-federation:appbuilder');
    logger.info('');
    logger.info('You need to run it once per application to migrate');
    logger.info('Please find more information here: https://shorturl.at/gADJW');
    return;
  }

  let options = (await context.validateOptions(
    _options,
    builder
  )) as JsonObject & Schema;

  const outerOptions = options as DevServerBuilderOptions;
  const normOuterOptions = nfOptions.dev
    ? await normalizeOptions(context, context.target.project, outerOptions)
    : null;

  if (nfOptions.dev) {
    target = targetFromTargetString(outerOptions.buildTarget);
    _options = (await context.getTargetOptions(
      target
    )) as unknown as JsonObject & Schema;

    builder = await context.getBuilderNameForTarget(target);
    options = (await context.validateOptions(_options, builder)) as JsonObject &
      Schema;
  }
  const metadata = await context.getProjectMetadata(context.target.project);
  const i18nOpts = createI18nOptions(metadata, options.localize);

  const runServer = !!nfOptions.port;
  const write = !runServer;
  const watch = !!runServer || nfOptions.watch;

  options.watch = watch;
  const rebuildEvents = new RebuildHubs();

  const adapter = createAngularBuildAdapter(options, context, rebuildEvents);
  setBuildAdapter(adapter);

  setLogLevel(options.verbose ? 'verbose' : 'info');

  const outputPath = path.join(options.outputPath as string, 'browser');

  const fedOptions: FederationOptions = {
    workspaceRoot: context.workspaceRoot,
    outputPath: outputPath,
    federationConfig: infereConfigPath(options.tsConfig),
    tsConfig: options.tsConfig,
    verbose: options.verbose,
    watch: false, // options.watch,
    dev: !!nfOptions.dev,
  };

  const config = await loadFederationConfig(fedOptions);
  const externals = getExternals(config);
  const plugins = [
    createSharedMappingsPlugin(config.sharedMappings),
    {
      name: 'externals',
      setup(build: PluginBuild) {
        if (build.initialOptions.platform !== 'node') {
          build.initialOptions.external = externals.filter(
            (e) => e !== 'tslib'
          );
        }
      },
    },
  ];
  const middleware = [getFederationFilesMiddleware(fedOptions, i18nOpts)];

  const memResults = new MemResults();

  let first = true;
  let lastResult: { success: boolean } | undefined;

  if (existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true });
  }

  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
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

  const appBuilderName = '@angular-devkit/build-angular:application';

  const builderRun = nfOptions.dev
    ? serveWithVite(
        normOuterOptions,
        appBuilderName,
        context,
        nfOptions.skipHtmlTransform ? {} : {
          indexHtml: transformIndexHtml,
        },
        {
          buildPlugins: plugins,
          middleware,
        }
      )
    : buildApplication(options, context, plugins);

  // builderRun.output.subscribe(async (output) => {
  for await (const output of builderRun) {
    lastResult = output;

    if (!output.success) {
      setError('Compilation Error');
      if (nfOptions.dev) {
        reloadBrowser();
        continue;
      } else {
        yield output;
      }
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

    prepareBundles(
      options,
      fedOptions,
      i18nOpts,
      output,
      write && !nfOptions.dev && !nfOptions.skipHtmlTransform,
      memResults
    );

    if (first && runServer) {
      startServer(nfOptions, options.outputPath as string, memResults);
    }

    if (!first && runServer) {
      reloadBrowser();
    }

    if (!runServer) {
      yield output;
    }

    if (!first && nfOptions.dev) {
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

  yield lastResult || { success: false };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default createBuilder(runBuilder) as any;

function infereConfigPath(tsConfig: string): string {
  const relProjectPath = path.dirname(tsConfig);
  const relConfigPath = path.join(relProjectPath, 'federation.config.js');

  return relConfigPath;
}

function transformIndexHtml(content: string): Promise<string> {
  return Promise.resolve(updateScriptTags(content, 'main.js', 'polyfills.js'));
}
