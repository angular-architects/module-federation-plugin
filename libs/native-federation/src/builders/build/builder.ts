import * as path from 'path';
import * as fs from 'fs';
import * as mrmime from 'mrmime';

import { buildApplication, ApplicationBuilderOptions } from '@angular/build';
import {
  serveWithVite,
  buildApplicationInternal,
} from '@angular/build/private';

import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import { DevServerBuilderOptions } from '@angular-devkit/build-angular';
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
import { reloadBrowser, reloadShell, setError } from '../../utils/dev-server';
import { RebuildHubs } from '../../utils/rebuild-events';
import { updateIndexHtml, updateScriptTags } from '../../utils/updateIndexHtml';
import { existsSync, mkdirSync, rmSync } from 'fs';
import {
  EsBuildResult,
  MemResults,
  NgCliAssetResult,
} from '../../utils/mem-resuts';
import { JsonObject } from '@angular-devkit/core';
import { createSharedMappingsPlugin } from '../../utils/shared-mappings-plugin';
// import { NextHandleFunction } from 'vite';
import { PluginBuild } from 'esbuild';
import { FederationInfo } from '@softarc/native-federation-runtime';

function _buildApplication(options, context, pluginsOrExtensions) {
  let extensions;
  if (pluginsOrExtensions && Array.isArray(pluginsOrExtensions)) {
    extensions = {
      codePlugins: pluginsOrExtensions,
    };
  } else {
    extensions = pluginsOrExtensions;
  }
  return buildApplicationInternal(options, context, extensions);
}

export async function* runBuilder(
  nfOptions: NfBuilderSchema,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  let target = targetFromTargetString(nfOptions.target);

  let _options = (await context.getTargetOptions(
    target
  )) as unknown as JsonObject & ApplicationBuilderOptions;

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
  )) as JsonObject & ApplicationBuilderOptions;

  const outerOptions = options as DevServerBuilderOptions;
  const normOuterOptions = nfOptions.dev
    ? await normalizeOptions(context, context.target.project, outerOptions)
    : null;

  if (nfOptions.dev) {
    target = targetFromTargetString(outerOptions.buildTarget);
    _options = (await context.getTargetOptions(
      target
    )) as unknown as JsonObject & ApplicationBuilderOptions;

    builder = await context.getBuilderNameForTarget(target);
    options = (await context.validateOptions(_options, builder)) as JsonObject &
      ApplicationBuilderOptions;
  }

  const runServer = !!nfOptions.port;
  const write = !runServer;
  const watch = !!runServer || nfOptions.watch;

  options.watch = watch;

  if (nfOptions.baseHref) {
    options.baseHref = nfOptions.baseHref;
  }

  const rebuildEvents = new RebuildHubs();

  const adapter = createAngularBuildAdapter(options, context, rebuildEvents);
  setBuildAdapter(adapter);

  setLogLevel(options.verbose ? 'verbose' : 'info');

  const outputPath = options.outputPath;

  const outputOptions: Required<
    Exclude<ApplicationBuilderOptions['outputPath'], string>
  > = {
    browser: 'browser',
    server: 'server',
    media: 'media',
    ...(typeof outputPath === 'string' ? undefined : outputPath),
    base: typeof outputPath === 'string' ? outputPath : outputPath.base,
  };

  const browserOutputPath = path.join(
    outputOptions.base,
    outputOptions.browser
  );

  const fedOptions: FederationOptions = {
    workspaceRoot: context.workspaceRoot,
    outputPath: browserOutputPath,
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
        if (nfOptions.ssr || build.initialOptions.platform !== 'node') {
          build.initialOptions.external = externals.filter(
            (e) => e !== 'tslib'
          );
        }
      },
    },
  ];

  const middleware = [
    (req, res, next) => {
      const url = removeBaseHref(req, options.baseHref);

      const fileName = path.join(
        fedOptions.workspaceRoot,
        fedOptions.outputPath,
        url
      );

      const exists = fs.existsSync(fileName);

      if (url !== '/' && url !== '' && exists) {
        const lookup = mrmime.lookup;
        const mimeType = lookup(path.extname(fileName)) || 'text/javascript';
        const rawBody = fs.readFileSync(fileName, 'utf-8');
        const body = addDebugInformation(url, rawBody);
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

  const memResults = new MemResults();

  let first = true;
  let lastResult: { success: boolean } | undefined;

  if (existsSync(fedOptions.outputPath)) {
    rmSync(fedOptions.outputPath, { recursive: true });
  }

  if (!existsSync(fedOptions.outputPath)) {
    mkdirSync(fedOptions.outputPath, { recursive: true });
  }

  if (!write) {
    setMemResultHandler((outFiles, outDir) => {
      const fullOutDir = outDir
        ? path.join(fedOptions.workspaceRoot, outDir)
        : null;
      memResults.add(outFiles.map((f) => new EsBuildResult(f, fullOutDir)));
    });
  }

  try {
    await buildForFederation(config, fedOptions, externals);
  } catch (e) {
    process.exit(1);
  }

  options.deleteOutputPath = false;

  const appBuilderName = '@angular-devkit/build-angular:application';

  const builderRun = nfOptions.dev
    ? serveWithVite(
        normOuterOptions,
        appBuilderName,
        _buildApplication,
        context,
        nfOptions.skipHtmlTransform
          ? {}
          : { indexHtml: transformIndexHtml(nfOptions) },
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

    if (write && !nfOptions.dev && !nfOptions.skipHtmlTransform) {
      updateIndexHtml(fedOptions, nfOptions);
    }

    if (!runServer) {
      yield output;
    }

    if (!first && nfOptions.dev) {
      setTimeout(async () => {
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

function removeBaseHref(req: any, baseHref?: string) {
  let url = req.url;

  if (baseHref && url.startsWith(baseHref)) {
    url = url.substr(baseHref.length);
  }
  return url;
}

function infereConfigPath(tsConfig: string): string {
  const relProjectPath = path.dirname(tsConfig);
  const relConfigPath = path.join(relProjectPath, 'federation.config.cjs');

  return relConfigPath;
}

function transformIndexHtml(
  nfOptions: NfBuilderSchema
): (content: string) => Promise<string> {
  return (content: string): Promise<string> =>
    Promise.resolve(
      updateScriptTags(content, 'main.js', 'polyfills.js', nfOptions)
    );
}

function addDebugInformation(fileName: string, rawBody: string): string {
  if (fileName !== '/remoteEntry.json') {
    return rawBody;
  }

  const remoteEntry = JSON.parse(rawBody) as FederationInfo;
  const shared = remoteEntry.shared;

  if (!shared) {
    return rawBody;
  }

  const sharedForVite = shared.map((s) => ({
    ...s,
    packageName: `/@id/${s.packageName}`,
  }));

  remoteEntry.shared = [...shared, ...sharedForVite];

  return JSON.stringify(remoteEntry, null, 2);
}
