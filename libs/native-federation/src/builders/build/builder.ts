import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { BuildBuilderSchema } from './schema';

import { buildEsbuildBrowser } from '@angular-devkit/build-angular/src/builders/browser-esbuild/index';
import { Schema } from '@angular-devkit/build-angular/src/builders/browser-esbuild/schema';
import * as path from 'path';
import * as fs from 'fs';
import { FederationConfig } from '../../config/federation-config';

import { bundle } from '../utils/build-utils';

export async function runBuilder(
  options: Schema,
  context: BuilderContext
): Promise<BuilderOutput> {
  
  const config = await loadFederationConfig(options, context);

  console.log('config', config);

  const externals = getExternals(config);

  for (const key in config.exposes) {
    const outFile = key + '.js';
    const outFilePath = path.join(options.outputPath, outFile);
    const entryPoint = config.exposes[key];

    console.info('Bundle exposed file', entryPoint);

    await bundle({ 
      entryPoint, 
      tsConfigPath: options.tsConfig, 
      external: externals, 
      outfile: outFilePath 
    });
  }

  // const shared 
  // for (const entry of shareConfig) {
  //       const fileName = entry.packageName.replace(/[^A-Za-z0-9]/g, "_");
  //       const outFile = `dist/cli14/${fileName}.js`;
  //       const entryPoints = [entry.entryPoint];
    
  //       // await bundle({ entryPoint: entryPoints, tsConfigPath: external, external: outFile });
  // }    

  options.externalDependencies = externals;
  const output = await buildEsbuildBrowser(options, context)

  return output;

}

export default createBuilder(runBuilder);

function getExternals(config: FederationConfig) {
  return config.shared ? Object.keys(config.shared) : [];
}

async function loadFederationConfig(options: Schema, context: BuilderContext) {
  const relProjectPath = path.dirname(options.tsConfig);
  const fullProjectPath = path.join(context.workspaceRoot, relProjectPath);
  const fullConfigPath = path.join(fullProjectPath, 'federation.config.js');

  if (!fs.existsSync(fullConfigPath)) {
    throw new Error('Expected ' + fullConfigPath);
  }

  const config = await import(fullConfigPath) as FederationConfig;
  return config;
}

