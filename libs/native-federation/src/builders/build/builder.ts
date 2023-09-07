/* eslint-disable @nx/enforce-module-boundaries */
import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import { Schema } from '@angular-devkit/build-angular/src/builders/browser-esbuild/schema';

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
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { EsBuildResult, MemResults } from '../../utils/mem-resuts';
import { JsonObject } from '@angular-devkit/core';

function log(...args) {
  const msg = args.join(' ');
  appendFileSync('c:/temp/log.txt', msg + '\n');
  console.log(args);
}

export async function runBuilder(
  nfOptions: NfBuilderSchema,
  context: BuilderContext
): Promise<BuilderOutput> {
  const target = targetFromTargetString(nfOptions.target);
  const _options = (await context.getTargetOptions(
    target
  )) as unknown as JsonObject & Schema;

  const builder = await context.getBuilderNameForTarget(target);
  const options = (await context.validateOptions(
    _options,
    builder
  )) as JsonObject & Schema;

  const rebuildEvents = new RebuildHubs();

  const adapter = createAngularBuildAdapter(options, context, rebuildEvents);
  setBuildAdapter(adapter);

  setLogLevel(options.verbose ? 'verbose' : 'info');

  options.watch = !!nfOptions.dev;

  const fedOptions: FederationOptions = {
    workspaceRoot: context.workspaceRoot,
    outputPath: options.outputPath,
    federationConfig: infereConfigPath(options.tsConfig),
    tsConfig: options.tsConfig,
    verbose: options.verbose,
    watch: options.watch,
    dev: !!nfOptions.dev,
  };

  const config = await loadFederationConfig(fedOptions);
  const externals = getExternals(config);

  options.externalDependencies = externals.filter((e) => e !== 'tslib');

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
  const write = !nfOptions.dev;
  let first = true;
  let lastResult: { success: boolean } | undefined;

  if (!existsSync(options.outputPath)) {
    mkdirSync(options.outputPath);
  }

  if (!write) {
    setMemResultHandler((outFiles) => {
      memResults.add(outFiles.map((f) => new EsBuildResult(f)));
    });
  }

  // builderRun.output.subscribe(async (output) => {
  for await (const output of buildEsbuildBrowser(options, context as any, {
    write,
  })) {
    lastResult = output;

    if (!output.success) {
      setError('Compilation Error');
      reloadBrowser();
      continue;
    } else {
      setError(null);
    }

    if (!write) {
      memResults.add(output.outputFiles.map((file) => new EsBuildResult(file)));

      // TODO!
      // '{\n' +
      // '  "success": true,\n' +
      // '  "assetFiles": [\n' +
      // '    {\n' +
      // '      "source": "C:\\\\temp\\\\native\\\\src\\\\favicon.ico",\n' +
      // '      "destination": "favicon.ico"\n' +
      // '    },\n' +
      // '    {\n' +
      // '      "source": "C:\\\\temp\\\\native\\\\src\\\\assets\\\\shutterstock_1835092750.jpg",\n' +
      // '      "destination": "assets\\\\shutterstock_1835092750.jpg"\n' +
      // '    }\n' +
      // '  ]\n' +
      // '}'
    }

    if (write) {
      updateIndexHtml(fedOptions);
    }

    if (first) {
      await buildForFederation(config, fedOptions, externals);
    }

    if (first && nfOptions.dev) {
      startServer(nfOptions, options.outputPath, memResults);
    } else if (!first && nfOptions.dev) {
      reloadBrowser();

      setTimeout(async () => {
        logger.info('Rebuilding federation artefacts ...');
        await Promise.all([rebuildEvents.rebuild.emit()]);
        logger.info('Done!');

        setTimeout(() => reloadShell(nfOptions.shell), 0);
      }, nfOptions.rebuildDelay);
    }

    first = false;
  }

  // updateIndexHtml(fedOptions);
  // const output = await lastValueFrom(builderRun.output as any);
  return lastResult || { success: false };
}

export default createBuilder(runBuilder) as any;

function infereConfigPath(tsConfig: string): string {
  const relProjectPath = path.dirname(tsConfig);
  const relConfigPath = path.join(relProjectPath, 'federation.config.js');

  return relConfigPath;
}
