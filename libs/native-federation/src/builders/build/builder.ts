import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import { buildEsbuildBrowser } from '@angular-devkit/build-angular/src/builders/browser-esbuild/index';
import { Schema } from '@angular-devkit/build-angular/src/builders/browser-esbuild/schema';
import * as path from 'path';
import * as fs from 'fs';
import { FederationConfig, NormalizedFederationConfig } from '../../config/federation-config';

import { bundle } from '../utils/build-utils';
import { getPackageInfo } from '../utils/package-info';
import { SharedInfo, ExposesInfo, FederationInfo} from '../utils/federation-info';

const DEFAULT_SKIP_LIST = new Set([
  '@angular-architects/native-federation',
  'es-module-shims'
]);

export async function runBuilder(
  options: Schema,
  context: BuilderContext
): Promise<BuilderOutput> {
  
  const config = await loadFederationConfig(options, context);

  console.log('config', config);

  const externals = getExternals(config);

  options.externalDependencies = externals;
  const output = await buildEsbuildBrowser(options, context)

  const exposesInfo = await bundleExposed(config, options, externals);
  const sharedInfo = await bundleShared(config, options, context, externals);

  const federationInfo: FederationInfo = {
    name: config.name,
    shared: sharedInfo,
    exposes: exposesInfo
  };

  writeFederationInfo(federationInfo, context, options);

  writeImportMap(sharedInfo, context, options);

  return output;

}

export default createBuilder(runBuilder);

function writeImportMap(sharedInfo: SharedInfo[], context: BuilderContext, options: Schema) {
  const imports = sharedInfo.reduce((acc, cur) => {
    return {
      ...acc,
      [cur.packageName]: cur.outFileName
    };
  }, {});

  const importMap = { imports };
  const importMapPath = path.join(context.workspaceRoot, options.outputPath, 'importmap.json');
  fs.writeFileSync(importMapPath, JSON.stringify(importMap, null, 2));
}

function writeFederationInfo(federationInfo: FederationInfo, context: BuilderContext, options: Schema) {
  const metaDataPath = path.join(context.workspaceRoot, options.outputPath, 'remoteEntry.json');
  fs.writeFileSync(metaDataPath, JSON.stringify(federationInfo, null, 2));
}

async function bundleShared(config: NormalizedFederationConfig, options: Schema, context: BuilderContext, externals: string[]): Promise<Array<SharedInfo>> {
  
  const result: Array<SharedInfo> = [];

  const packageInfos = 
    Object
      .keys(config.shared)
      .map(packageName => getPackageInfo(packageName, context))
      .filter(pi => !!pi);

  for (const pi of packageInfos) {

    const outFileName = pi.packageName.replace(/[^A-Za-z0-9]/g, "_") + '.js';
    const outFilePath = path.join(options.outputPath, outFileName);
    const shared = config.shared[pi.packageName];

    console.info('Bundling shared package', pi.packageName, '...');

    await bundle({
      entryPoint: pi.entryPoint,
      tsConfigPath: options.tsConfig,
      external: externals,
      outfile: outFilePath
    });

    result.push({
      packageName: pi.packageName,
      outFileName: outFileName,
      requiredVersion: shared.requiredVersion,
      singleton: shared.singleton,
      strictVersion: shared.strictVersion,
      version: pi.version
    });
  }

  return result;
}

async function bundleExposed(config: NormalizedFederationConfig, options: Schema, externals: string[]): Promise<Array<ExposesInfo>> {
  
  const result: Array<ExposesInfo> = [];
  
  for (const key in config.exposes) {
    const outFileName = key + '.js';
    const outFilePath = path.join(options.outputPath, outFileName);
    const entryPoint = config.exposes[key];

    console.info('Bundle exposed file', entryPoint, '...');

    await bundle({
      entryPoint,
      tsConfigPath: options.tsConfig,
      external: externals,
      outfile: outFilePath
    });

    result.push({ key, outFileName });
  }
  return result;
}

function getExternals(config: FederationConfig) {
  return config.shared ? 
    Object.keys(config.shared)
      .filter(p => !DEFAULT_SKIP_LIST.has(p)) : 
    [];
}

async function loadFederationConfig(options: Schema, context: BuilderContext) {
  const relProjectPath = path.dirname(options.tsConfig);
  const fullProjectPath = path.join(context.workspaceRoot, relProjectPath);
  const fullConfigPath = path.join(fullProjectPath, 'federation.config.js');

  if (!fs.existsSync(fullConfigPath)) {
    throw new Error('Expected ' + fullConfigPath);
  }

  const config = await import(fullConfigPath) as NormalizedFederationConfig;
  return config;
}

