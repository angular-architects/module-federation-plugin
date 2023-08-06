import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import { Schema } from '@angular-devkit/build-angular/src/builders/browser-esbuild/schema';

import * as path from 'path';
import { setLogLevel, logger } from '@softarc/native-federation/build';

import { FederationOptions } from '@softarc/native-federation/build';
import { setBuildAdapter } from '@softarc/native-federation/build';
import { createAngularBuildAdapter } from '../../utils/angular-esbuild-adapter';
import { getExternals } from '@softarc/native-federation/build';
import { loadFederationConfig } from '@softarc/native-federation/build';
import { buildForFederation } from '@softarc/native-federation/build';
import { targetFromTargetString } from '@angular-devkit/architect';

import { NfBuilderSchema } from './schema';
import { lastValueFrom } from 'rxjs';
import {
  reloadBrowser,
  reloadShell,
  startServer,
} from '../../utils/dev-server';
import { RebuildHubs } from '../../utils/rebuild-events';
import { updateIndexHtml } from '../../utils/updateIndexHtml';

export async function runBuilder(
  nfOptions: NfBuilderSchema,
  context: BuilderContext
): Promise<BuilderOutput> {
  const target = targetFromTargetString(nfOptions.target);
  const options = (await context.getTargetOptions(target)) as unknown as Schema;
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

  const builderRun = await context.scheduleBuilder(
    '@angular-devkit/build-angular:browser-esbuild',
    options as any,
    { target }
  );

  // TODO: Allow more flexibility?
  // const builderRun = await context.scheduleTarget(target, options as any);

  let first = true;
  builderRun.output.subscribe(async (output) => {
    if (!output.success) {
      return;
    }

    updateIndexHtml(fedOptions);

    if (first) {
      await buildForFederation(config, fedOptions, externals);
    }

    if (first && nfOptions.dev) {
      startServer(nfOptions, options.outputPath);
    } else if (!first && nfOptions.dev) {
      reloadBrowser();

      setTimeout(async () => {
        logger.info('Rebuilding federation artefacts ...');
        await Promise.all([
          rebuildEvents.rebuildMappings.emit(),
          rebuildEvents.rebuildExposed.emit(),
        ]);
        logger.info('Done!');

        setTimeout(() => reloadShell(nfOptions.shell), 0);
      }, nfOptions.rebuildDelay);
    }

    first = false;
  });

  // updateIndexHtml(fedOptions);
  const output = await lastValueFrom(builderRun.output as any);
  return output as BuilderOutput;
}

export default createBuilder(runBuilder);

function infereConfigPath(tsConfig: string): string {
  const relProjectPath = path.dirname(tsConfig);
  const relConfigPath = path.join(relProjectPath, 'federation.config.js');

  return relConfigPath;
}
