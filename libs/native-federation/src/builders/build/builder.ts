import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import { buildEsbuildBrowser } from '@angular-devkit/build-angular/src/builders/browser-esbuild/index';
import { Schema } from '@angular-devkit/build-angular/src/builders/browser-esbuild/schema';

import * as path from 'path';
import * as fs from 'fs';
import {
  setLogLevel,
} from '@softarc/native-federation/build';

import { FederationOptions } from '@softarc/native-federation/build';
import { setBuildAdapter } from '@softarc/native-federation/build';
import { createAngularBuildAdapter } from '../../utils/angular-esbuild-adapter';
import { getExternals } from '@softarc/native-federation/build';
import { loadFederationConfig } from '@softarc/native-federation/build';
import { buildForFederation } from '@softarc/native-federation/build';
import { targetFromTargetString } from '@angular-devkit/architect';

import { NfBuilderSchema } from './schema';
import { Observable, lastValueFrom } from 'rxjs';

export async function runBuilder(
  nfOptions: NfBuilderSchema,
  context: BuilderContext
): Promise<BuilderOutput> {

  const target = targetFromTargetString(nfOptions.target);
  const options = (await context.getTargetOptions(target)) as unknown as Schema;

  const adapter = createAngularBuildAdapter(options, context);
  setBuildAdapter(adapter);
  
  setLogLevel(options.verbose ? 'verbose' : 'info');

  const fedOptions: FederationOptions = {
    workspaceRoot: context.workspaceRoot,
    outputPath: options.outputPath,
    federationConfig: infereConfigPath(options.tsConfig),
    tsConfig: options.tsConfig,
    verbose: options.verbose,
    watch: options.watch,
  };

  const config = await loadFederationConfig(fedOptions);
  const externals = getExternals(config);

  options.externalDependencies = externals.filter((e) => e !== 'tslib');

  // TODO: Use output?

  const builderRun = await context.scheduleBuilder('@angular-devkit/build-angular:browser-esbuild', options as any, { target });
  // const outputs = buildEsbuildBrowser(options, context as any);
  // let output;
  // for await (const o of outputs) { 
  //   output = o;
  // }  
 
  const output = await lastValueFrom(builderRun.output as any);
  await buildForFederation(config, fedOptions, externals);

  updateIndexHtml(fedOptions);
  return output as BuilderOutput;
}

export default createBuilder(runBuilder);

function updateIndexHtml(fedOptions: FederationOptions) {
  const outputPath = path.join(fedOptions.workspaceRoot, fedOptions.outputPath);
  const indexPath = path.join(outputPath, 'index.html');
  const mainName = fs
    .readdirSync(outputPath)
    .find((f) => f.startsWith('main.') && f.endsWith('.js'));
  const polyfillsName = fs
    .readdirSync(outputPath)
    .find((f) => f.startsWith('polyfills.') && f.endsWith('.js'));

  const htmlFragment = `
<script type="esms-options">
{
  "shimMode": true
}
</script>

<script type="module" src="${polyfillsName}"></script>
<script type="module-shim" src="${mainName}"></script>
`;

  let indexContent = fs.readFileSync(indexPath, 'utf-8');
  indexContent = indexContent.replace(/<script src="polyfills.*?>/, '');
  indexContent = indexContent.replace(/<script src="main.*?>/, '');
  indexContent = indexContent.replace(
    '</body>',
    `${htmlFragment}</body>`
  );
  fs.writeFileSync(indexPath, indexContent, 'utf-8');
}

function infereConfigPath(tsConfig: string): string {
  const relProjectPath = path.dirname(tsConfig);
  const relConfigPath = path.join(relProjectPath, 'federation.config.js');

  return relConfigPath;
}



