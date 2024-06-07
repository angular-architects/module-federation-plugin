import * as path from 'path';
import * as fs from 'fs';
import * as mrmime from 'mrmime';

import { ApplicationBuilderOptions } from '@angular/build/src/builders/application';
import { Schema } from '@angular/build/src/builders/application/schema';

import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import {
  buildApplication,
  buildApplicationInternal,
} from '@angular/build/src/builders/application';
import { serveWithVite } from '@angular/build/src/builders/dev-server/vite-server';

import { DevServerBuilderOptions } from '@angular-devkit/build-angular';
import { normalizeOptions } from '@angular-devkit/build-angular/src/builders/dev-server/options';

import { setLogLevel, logger } from '@softarc/native-federation/build';

import { FederationOptions } from '@softarc/native-federation/build';
import { setBuildAdapter } from '@softarc/native-federation/build';
import { getExternals } from '@softarc/native-federation/build';
import { loadFederationConfig } from '@softarc/native-federation/build';
import { buildForFederation } from '@softarc/native-federation/build';
import { targetFromTargetString } from '@angular-devkit/architect';

import { moduleFederationPlugin } from '@module-federation/esbuild/dist/plugin.cjs';
// import { moduleFederationPlugin } from '@module-federation/esbuild/plugin';
// const plugin_cjs_1 = require("@module-federation/esbuild/plugin");


import { NfBuilderSchema } from './schema';
import {
  reloadBrowser,
  reloadShell,
  setError,
  startServer,
} from '../../utils/dev-server';
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
import { Connect } from 'vite';
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
  return buildApplicationInternal(
    options,
    context,
    { write: false },
    extensions
  );
}

export async function* runBuilder(
  nfOptions: NfBuilderSchema,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  let target = targetFromTargetString(nfOptions.target);

  let _options = (await context.getTargetOptions(
    target
  )) as unknown as JsonObject & Schema;

  let builder = await context.getBuilderNameForTarget(target);

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

  const runServer = !!nfOptions.port;
  const write = !runServer;
  const watch = !!runServer || nfOptions.watch;

  options.watch = watch;

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

  const fedOptions = {
    workspaceRoot: context.workspaceRoot,
    outputPath: browserOutputPath,
    federationConfig: infereConfigPath(options.tsConfig),
    tsConfig: options.tsConfig,
    verbose: options.verbose,
    watch: false, // options.watch,
    dev: !!nfOptions.dev,
  };

  const fullConfigPath = path.join(
    fedOptions.workspaceRoot,
    fedOptions.federationConfig
  );

  const config = await import(fullConfigPath);

  const plugins = [
    moduleFederationPlugin(config)
  ];

  // const middleware: Connect.NextHandleFunction[] = [
  //   (req, res, next) => {
  //     const fileName = path.join(
  //       fedOptions.workspaceRoot,
  //       fedOptions.outputPath,
  //       req.url
  //     );
  //     const exists = fs.existsSync(fileName);

  //     if (req.url !== '/' && req.url !== '' && exists) {
  //       const lookup = mrmime.lookup;
  //       const mimeType = lookup(path.extname(fileName)) || 'text/javascript';
  //       const rawBody = fs.readFileSync(fileName, 'utf-8');
  //       const body = addDebugInformation(req.url, rawBody);
  //       res.writeHead(200, {
  //         'Content-Type': mimeType,
  //         'Access-Control-Allow-Origin': '*',
  //         'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  //         'Access-Control-Allow-Headers': 'Content-Type',
  //       });
  //       res.end(body);
  //     } else {
  //       next();
  //     }
  //   },
  // ];

  // const memResults = new MemResults();

  let first = true;
  let lastResult: { success: boolean } | undefined;

  if (existsSync(fedOptions.outputPath)) {
    rmSync(fedOptions.outputPath, { recursive: true });
  }

  if (!existsSync(fedOptions.outputPath)) {
    mkdirSync(fedOptions.outputPath, { recursive: true });
  }

  // if (!write) {
  //   setMemResultHandler((outFiles, outDir) => {
  //     const fullOutDir = outDir
  //       ? path.join(fedOptions.workspaceRoot, outDir)
  //       : null;
  //     memResults.add(outFiles.map((f) => new EsBuildResult(f, fullOutDir)));
  //   });
  // }

  // await buildForFederation(config, fedOptions, externals);

  options.deleteOutputPath = false;

  // TODO: Clarify how DevServer needs to be executed. Not sure if its right.
  // TODO: Clarify if buildApplication is needed `executeDevServerBuilder` seems to choose the correct DevServer

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
          buildPlugins: plugins as any,
          // middleware,
        }
      )
    : buildApplication(options, context, plugins as any);

    // return builderRun;
  // builderRun.output.subscribe(async (output) => {
  for await (const output of builderRun) {
    lastResult = output;

    // if (!output.success) {
    //   setError('Compilation Error');
    //   reloadBrowser();
    //   continue;
    // } else {
    //   setError(null);
    // }

    if (!runServer) {
      yield output;
    }

  

    // first = false;
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
