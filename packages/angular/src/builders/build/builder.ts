import './setup-builder-env-variables.js';

import * as fs from 'fs';
import * as mrmime from 'mrmime';
import * as path from 'path';

import { type ApplicationBuilderOptions, buildApplication } from '@angular/build';
import { buildApplicationInternal, serveWithVite, SourceFileCache } from '@angular/build/private';

import {
  type BuilderContext,
  type BuilderOutput,
  createBuilder,
  targetFromTargetString,
} from '@angular-devkit/architect';

import { normalizeOptions } from '@angular-devkit/build-angular/src/builders/dev-server/options.js';
import type { Schema as DevServerSchema } from '@angular-devkit/build-angular/src/builders/dev-server/schema.js';

import {
  buildForFederation,
  rebuildForFederation,
  type FederationInfo,
  type NormalizedFederationOptions,
  getExternals,
  loadFederationConfig,
  normalizeFederationOptions,
  setBuildAdapter,
  createFederationCache,
} from '@softarc/native-federation';
import {
  logger,
  setLogLevel,
  RebuildQueue,
  AbortedError,
  getDefaultCachePath,
} from '@softarc/native-federation/internal';
import { createAngularBuildAdapter } from '../../utils/angular-esbuild-adapter.js';
import { type JsonObject } from '@angular-devkit/core';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { fstart } from '../../tools/fstart-as-data-url.js';
import { type Plugin, type PluginBuild } from 'esbuild';
import { getI18nConfig, translateFederationArtifacts } from '../../utils/i18n.js';
import { createSharedMappingsPlugin } from '../../utils/shared-mappings-plugin.js';
import { updateScriptTags } from '../../utils/updateIndexHtml.js';
import { federationBuildNotifier } from './federation-build-notifier.js';
import { type NfBuilderSchema } from './schema.js';

const originalWrite = process.stderr.write.bind(process.stderr);

process.stderr.write = function (
  chunk: string | Uint8Array,
  encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
  callback?: (err?: Error | null) => void
): boolean {
  const str = typeof chunk === 'string' ? chunk : chunk.toString();

  if (str.includes('vite:import-analysis') && str.includes('es-module-shims.js')) {
    return true;
  }

  if (typeof encodingOrCallback !== 'string') {
    return originalWrite(chunk, encodingOrCallback);
  }

  return originalWrite(chunk, encodingOrCallback as BufferEncoding, callback);
};

const createInternalAngularBuilder =
  (_: NormalizedFederationOptions<SourceFileCache>) =>
  (
    options: Parameters<typeof buildApplicationInternal>[0],
    context: BuilderContext,
    pluginsOrExtensions?: Plugin[] | Parameters<typeof buildApplicationInternal>[2]
  ) => {
    let extensions: Parameters<typeof buildApplicationInternal>[2];
    if (pluginsOrExtensions && Array.isArray(pluginsOrExtensions)) {
      extensions = {
        codePlugins: pluginsOrExtensions,
      };
    } else {
      extensions = pluginsOrExtensions as Parameters<typeof buildApplicationInternal>[2];
    }
    // options.codeBundleCache = nfOptions.federationCache.bundlerCache;
    return buildApplicationInternal(options, context, extensions);
  };

export async function* runBuilder(
  nfBuilderOptions: NfBuilderSchema,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  let target = targetFromTargetString(nfBuilderOptions.target);

  let targetOptions = (await context.getTargetOptions(target)) as unknown as JsonObject &
    ApplicationBuilderOptions;

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

  /**
   * Explicitly defined as devServer or if the target contains "serve"
   */
  const runServer =
    typeof nfBuilderOptions.devServer !== 'undefined'
      ? !!nfBuilderOptions.devServer
      : target.target.includes('serve');

  let options = (await context.validateOptions(
    runServer
      ? ({
          ...targetOptions,
          port: nfBuilderOptions.port || targetOptions['port'],
        } as JsonObject)
      : targetOptions,
    builder
  )) as JsonObject & ApplicationBuilderOptions;

  let serverOptions = null;

  const watch = nfBuilderOptions.watch;

  if (options['buildTarget']) {
    serverOptions = await normalizeOptions(
      context,
      context.target!.project,
      options as unknown as DevServerSchema
    );

    target = targetFromTargetString(options['buildTarget'] as string);
    targetOptions = (await context.getTargetOptions(target)) as unknown as JsonObject &
      ApplicationBuilderOptions;

    builder = await context.getBuilderNameForTarget(target);
    options = (await context.validateOptions(targetOptions, builder)) as JsonObject &
      ApplicationBuilderOptions;
  }

  options.watch = watch;

  if (nfBuilderOptions.baseHref) {
    options.baseHref = nfBuilderOptions.baseHref;
  }

  if (nfBuilderOptions.outputPath) {
    options.outputPath = nfBuilderOptions.outputPath;
  }

  const adapter = createAngularBuildAdapter(options, context);

  setBuildAdapter(adapter);

  setLogLevel(options.verbose ? 'verbose' : 'info');

  if (!options.outputPath) {
    options.outputPath = `dist/${context.target!.project}`;
  }

  const outputPath = options.outputPath;
  const outputOptions: Required<Exclude<ApplicationBuilderOptions['outputPath'], string>> = {
    browser: 'browser',
    server: 'server',
    media: 'media',
    ...(typeof outputPath === 'string' ? undefined : outputPath),
    base: typeof outputPath === 'string' ? outputPath : outputPath.base,
  };

  const i18n = await getI18nConfig(context);

  const localeFilter = getLocaleFilter(options, runServer);

  const sourceLocaleSegment =
    typeof i18n?.sourceLocale === 'string'
      ? i18n.sourceLocale
      : i18n?.sourceLocale?.subPath || i18n?.sourceLocale?.code || '';

  const browserOutputPath = path.join(
    outputOptions.base,
    outputOptions.browser,
    options.localize ? sourceLocaleSegment : ''
  );

  const differentDevServerOutputPath = Array.isArray(localeFilter) && localeFilter.length === 1;
  const devServerOutputPath = !differentDevServerOutputPath
    ? browserOutputPath
    : path.join(outputOptions.base, outputOptions.browser, localeFilter[0]!);

  const entryPoint = path.join(path.dirname(options.tsConfig), 'src/main.ts');

  const cachePath = getDefaultCachePath(context.workspaceRoot);
  const nfOptions = normalizeFederationOptions(
    {
      workspaceRoot: context.workspaceRoot,
      outputPath: browserOutputPath,
      federationConfig: inferConfigPath(options.tsConfig),
      tsConfig: options.tsConfig,
      verbose: options.verbose,
      watch: options.watch,
      dev: !!nfBuilderOptions.dev,
      chunks: !nfBuilderOptions.chunks ? false : nfBuilderOptions.chunks,
      entryPoint,
      buildNotifications: nfBuilderOptions.buildNotifications,
      cacheExternalArtifacts: nfBuilderOptions.cacheExternalArtifacts,
    },
    createFederationCache(cachePath, new SourceFileCache(cachePath))
  );

  const activateSsr = nfBuilderOptions.ssr && !nfBuilderOptions.dev;

  const start = process.hrtime();
  const config = await loadFederationConfig(nfOptions);
  logger.measure(start, 'To load the federation config.');

  const externals = getExternals(config);
  const plugins = [
    createSharedMappingsPlugin(config.sharedMappings),
    {
      name: 'externals',
      setup(build: PluginBuild) {
        if (!activateSsr && build.initialOptions.platform !== 'node') {
          build.initialOptions.external = externals.filter(e => e !== 'tslib');
        }
      },
    },
  ];

  // SSR build fails when externals are provided via the plugin
  if (activateSsr) {
    options.externalDependencies = externals;
  }

  const isLocalDevelopment = runServer && nfBuilderOptions.dev;

  // Initialize SSE reloader only for local development
  if (isLocalDevelopment && nfBuilderOptions.buildNotifications?.enable) {
    federationBuildNotifier.initialize(nfBuilderOptions.buildNotifications.endpoint);
  }

  const middleware = [
    ...(isLocalDevelopment
      ? [
          federationBuildNotifier.createEventMiddleware(req =>
            removeBaseHref(req, options.baseHref)
          ),
        ]
      : []),

    (
      req: { url?: string },
      res: {
        writeHead: (status: number, headers: Record<string, string>) => void;
        end: (body: string) => void;
      },
      next: () => void
    ) => {
      const url = removeBaseHref(req, options.baseHref);

      const fileName = path.join(nfOptions.workspaceRoot, devServerOutputPath, url);

      const exists = fs.existsSync(fileName);

      if (url !== '/' && url !== '' && exists) {
        const lookup = mrmime.lookup;
        const mimeType = lookup(path.extname(fileName)) || 'text/javascript';
        const rawBody = fs.readFileSync(fileName, 'utf-8');

        // TODO: Evaluate need for debug infos
        // const body = addDebugInformation(url, rawBody);
        const body = rawBody;

        res.writeHead(200, {
          'Content-Type': mimeType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end(body);
      } else {
        next();
      }
    },
  ];

  let first = true;

  if (existsSync(nfOptions.outputPath)) {
    rmSync(nfOptions.outputPath, { recursive: true });
  }

  if (!existsSync(nfOptions.outputPath)) {
    mkdirSync(nfOptions.outputPath, { recursive: true });
  }

  let federationResult: FederationInfo;
  try {
    const start = process.hrtime();
    federationResult = await buildForFederation(config, nfOptions, externals);
    logger.measure(start, 'To build the artifacts.');
  } catch (e) {
    logger.error((e as Error)?.message ?? 'Building the artifacts failed');
    process.exit(1);
  }

  if (activateSsr) {
    writeFstartScript(nfOptions);
  }

  const hasLocales = i18n?.locales && Object.keys(i18n.locales).length > 0;
  if (hasLocales && localeFilter) {
    const start = process.hrtime();

    translateFederationArtifacts(i18n, localeFilter, outputOptions.base, federationResult);
    logger.measure(start, 'To translate the artifacts.');
  }

  options.deleteOutputPath = false;

  const appBuilderName = '@angular/build:application';

  const builderRun = runServer
    ? serveWithVite(
        serverOptions as unknown as Parameters<typeof serveWithVite>[0],
        appBuilderName,
        createInternalAngularBuilder(nfOptions),
        context,
        nfBuilderOptions.skipHtmlTransform
          ? {}
          : { indexHtml: transformIndexHtml(nfBuilderOptions) },
        {
          buildPlugins: plugins,
          middleware,
        }
      )
    : buildApplication(options, context, {
        codePlugins: plugins,
        indexHtmlTransformer: transformIndexHtml(nfBuilderOptions),
      });

  const rebuildQueue = new RebuildQueue();

  const builderIterator = builderRun[Symbol.asyncIterator]();

  let ngBuildStatus: { success: boolean } = { success: false };

  try {
    let buildResult = await builderIterator.next();

    while (!buildResult.done) {
      if (buildResult.value) ngBuildStatus = buildResult.value;

      if (!first && (nfBuilderOptions.dev || watch)) {
        const nextOutputPromise = builderIterator.next();

        const trackResult = await rebuildQueue.track(async (signal: AbortSignal) => {
          try {
            if (signal?.aborted) {
              throw new AbortedError('Build canceled before starting');
            }

            await new Promise((resolve, reject) => {
              const timeout = setTimeout(resolve, Math.max(10, nfBuilderOptions.rebuildDelay));

              if (signal) {
                const abortHandler = () => {
                  clearTimeout(timeout);
                  reject(new AbortedError('[builder] During delay.'));
                };
                signal.addEventListener('abort', abortHandler, { once: true });
              }
            });

            if (signal?.aborted) {
              throw new AbortedError('[builder] Before federation build.');
            }

            const start = process.hrtime();

            // Invalidate all source files, Angular doesn't provide a way to give the invalidated files yet.
            const keys = [...nfOptions.federationCache.bundlerCache.keys()].filter(
              k => !k.includes('node_modules')
            );

            federationResult = await rebuildForFederation(
              config,
              nfOptions,
              externals,
              keys,
              signal
            );

            if (signal?.aborted) {
              throw new AbortedError('[builder] After federation build.');
            }

            if (hasLocales && localeFilter) {
              translateFederationArtifacts(
                i18n,
                localeFilter,
                outputOptions.base,
                federationResult
              );
            }

            if (signal?.aborted) {
              throw new AbortedError('[builder] After federation translations.');
            }

            logger.info('Done!');

            if (isLocalDevelopment) {
              federationBuildNotifier.broadcastBuildCompletion();
            }
            logger.measure(start, 'To rebuild the federation artifacts.');
            return { success: true };
          } catch (error) {
            if (error instanceof AbortedError) {
              logger.verbose('Rebuild was canceled. Cancellation point: ' + error?.message);
              federationBuildNotifier.broadcastBuildCancellation();
              return { success: false, cancelled: true };
            }
            logger.error('Federation rebuild failed!');
            if (options.verbose) console.error(error);
            if (isLocalDevelopment) {
              federationBuildNotifier.broadcastBuildError(error);
            }
            return { success: false };
          }
        }, nextOutputPromise);

        if (trackResult.type === 'completed') {
          if (!trackResult.result.cancelled) {
            yield { success: trackResult.result.success };
          }
          buildResult = await nextOutputPromise;
        } else {
          buildResult = trackResult.value;
        }
      } else {
        buildResult = await builderIterator.next();
      }
      first = false;
    }
  } finally {
    rebuildQueue.dispose();
    await adapter.dispose();

    if (isLocalDevelopment) {
      federationBuildNotifier.stopEventServer();
    }
  }

  yield ngBuildStatus;
}

function removeBaseHref(req: { url?: string }, baseHref?: string) {
  let url = req.url ?? '';

  if (baseHref && url.startsWith(baseHref)) {
    url = url.substr(baseHref.length);
  }
  return url;
}

function writeFstartScript(nfOptions: NormalizedFederationOptions) {
  const serverOutpath = path.join(nfOptions.outputPath, '../server');
  const fstartPath = path.join(serverOutpath, 'fstart.mjs');
  const buffer = Buffer.from(fstart, 'base64');
  fs.mkdirSync(serverOutpath, { recursive: true });
  fs.writeFileSync(fstartPath, buffer, 'utf-8');
}

function getLocaleFilter(options: ApplicationBuilderOptions, runServer: boolean) {
  let localize = options.localize || false;

  if (runServer && Array.isArray(localize) && localize.length > 1) {
    localize = false;
  }

  if (runServer && localize === true) {
    localize = false;
  }
  return localize;
}

function inferConfigPath(tsConfig: string): string {
  const relProjectPath = path.dirname(tsConfig);
  const relConfigPath = path.join(relProjectPath, 'federation.config.js');

  return relConfigPath;
}

function transformIndexHtml(nfOptions: NfBuilderSchema): (content: string) => Promise<string> {
  return (content: string): Promise<string> =>
    Promise.resolve(updateScriptTags(content, nfOptions));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default createBuilder(runBuilder) as any;
