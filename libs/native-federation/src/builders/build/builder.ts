/* eslint-disable @nx/enforce-module-boundaries */
import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import { Schema } from '@angular-devkit/build-angular/src/builders/application/schema';

// import { buildEsbuildBrowser } from '@angular-devkit/build-angular/src/builders/browser-esbuild';
import { buildApplication } from '@angular-devkit/build-angular/src/builders/application';
// import { execute as executeDevServer } from '@angular-devkit/build-angular/src/builders/dev-server/builder';

import { serveWithVite } from '@angular-devkit/build-angular/src/builders/dev-server/vite-server';
import { DevServerBuilderOptions } from '@angular-devkit/build-angular/src/builders/dev-server';
import { normalizeOptions } from '@angular-devkit/build-angular/src/builders/dev-server/options';

import * as path from 'path';
import * as fs from 'fs';

import * as mrmime from 'mrmime';

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
  const rebuildEvents = new RebuildHubs();

  const adapter = createAngularBuildAdapter(options, context, rebuildEvents);
  setBuildAdapter(adapter);

  setLogLevel(options.verbose ? 'verbose' : 'info');

  const outputPath = path.join(options.outputPath, 'browser');

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

  // options.externalDependencies = externals.filter((e) => e !== 'tslib');
  const plugins = [
    createSharedMappingsPlugin(config.sharedMappings),
    {
      name: 'externals',
      setup(build) {
        console.log('setup::')
        build.initialOptions.external = externals.filter((e) => e !== 'tslib');
      },
    },
    // {
    //   name: 'resolveId',
    //   setup(build: PluginBuild) {
    //     build.
    //     console.log('resolveId', source, importer, options);
    //   }
    // }
  ];

  const middleware: Connect.NextHandleFunction[] = [
    (req, res, next) => {
      const fileName = path.join(fedOptions.workspaceRoot, fedOptions.outputPath, req.url);
      const exists = fs.existsSync(fileName);

      if (req.url !== '/' && req.url !== '' && exists) {
        console.log('loading from disk', req.url)
        const lookup = mrmime.lookup;
        const mimeType = lookup(path.extname(fileName)) || 'text/javascript';
        const body = fs.readFileSync(fileName)
        res.writeHead(200, {
          'Content-Type': mimeType,
        });
        res.end(body);
      }
      else {
        next();
      }
    }
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

  // const x = buildEsbuildBrowser(
  //   options,
  //   context as any,
  //   {
  //     write,
  //   },
  //   plugins
  // );

  const appBuilderName = '@angular-devkit/build-angular:application';

  const builderRun = nfOptions.dev
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serveWithVite(normOuterOptions, appBuilderName, context, {
      indexHtml: transformIndexHtml
    }, {
      buildPlugins: plugins,
      middleware
    })
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

    if (write && !nfOptions.dev) {
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

function transformIndexHtml(content: string): Promise<string> {
  return Promise.resolve(updateScriptTags(content, 'main.js', 'polyfills.js'));
}
