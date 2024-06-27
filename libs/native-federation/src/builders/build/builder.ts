import * as path from 'path';

import { ApplicationBuilderOptions } from '@angular/build/src/builders/application';
import { OutputHashing, Schema } from '@angular/build/src/builders/application/schema';

import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import {
  buildApplication,
  buildApplicationInternal,
} from '@angular/build/src/builders/application';


import { logger } from '@softarc/native-federation/build';

import { targetFromTargetString } from '@angular-devkit/architect';

import { JsonObject } from '@angular-devkit/core';
import type { Plugin } from 'esbuild';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { entryPointsPlugin } from '../../utils/entry-points-plugin';
import { externalsPlugin } from '../../utils/externals-plugin';
import { initFederationBuild } from '../../utils/init-federation-build';
import { createSharedMappingsPlugin } from '../../utils/shared-mappings-plugin';
import { transformIndexHtml, updateScriptTags } from '../../utils/updateIndexHtml';
import { NfBuilderSchema } from './schema';

export async function* runBuilder(
  rawOptions: Schema,
  context: BuilderContext
): AsyncIterable<BuilderOutput> {
  let target = targetFromTargetString(rawOptions.target);

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
    rawOptions,
    builder
  )) as JsonObject & Schema;

  // we don't want builder to clear "dist" as long as initFederationBuild will put remoteEntry.json there before real build 
  options.deleteOutputPath = false;
  // it is impossible to hash files because initFederationBuild calc their names before real build
  // TODO: could pass through by patching remoteEntry.json after build, but there would be troubles with serve though
  options.outputHashing = OutputHashing.None;
  // federation responding for downloading all the parts, there is no need for builder to preload them
  if (typeof options.index !== 'boolean') {
    options.index = {
      input: typeof options.index === 'string' ? options.index : options.index.input,
      preloadInitial: false,
    }
  }


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

  if (existsSync(browserOutputPath)) {
    rmSync(browserOutputPath, { recursive: true });
  }
  if (!existsSync(browserOutputPath)) {
    mkdirSync(browserOutputPath, { recursive: true });
  }

  const fedData = await initFederationBuild(context.workspaceRoot, browserOutputPath, options.tsConfig);

  const plugins: Plugin[] = [
    entryPointsPlugin(fedData.entries),
    createSharedMappingsPlugin(fedData.sharedMappings),
    externalsPlugin(fedData.externals),
  ];

  return yield* buildApplication(options, context, {codePlugins: plugins, indexHtmlTransformer: transformIndexHtml()});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default createBuilder(runBuilder) as any;


