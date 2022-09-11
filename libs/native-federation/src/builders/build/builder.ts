import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';

import { buildEsbuildBrowser } from '@angular-architects/build-angular/src/builders/browser-esbuild/index';
import { Schema } from '@angular-architects/build-angular/src/builders/browser-esbuild/schema';
import { ExecutionTransformer } from '@angular-architects/build-angular';
import * as path from 'path';
import * as fs from 'fs';
import { NormalizedFederationConfig } from '@softarc/native-federation/build';

import { BuildOptions } from 'esbuild';
import { createSharedMappingsPlugin } from '../../utils/shared-mappings-plugin';
import { FederationOptions } from '@softarc/native-federation/build';
import { setBuildAdapter } from '@softarc/native-federation/build';
import { AngularEsBuildAdapter } from '../../utils/angular-esbuild-adapter';
import { getExternals } from '@softarc/native-federation/build';
import { loadFederationConfig } from '@softarc/native-federation/build';
import { buildForFederation } from '@softarc/native-federation/build';

export async function runBuilder(
  options: Schema,
  context: BuilderContext
): Promise<BuilderOutput> {
  setBuildAdapter(AngularEsBuildAdapter);

  const fedOptions: FederationOptions = {
    workspaceRoot: context.workspaceRoot,
    outputPath: options.outputPath,
    federationConfig: infereConfigPath(options.tsConfig),
    tsConfig: options.tsConfig,
    verbose: options.verbose,
  };

  const config = await loadFederationConfig(fedOptions);
  const externals = getExternals(config);

  options.externalDependencies = externals.filter(e => e !== 'tslib');
  const output = await build(config, options, context);

  await buildForFederation(config, fedOptions, externals);

  updateIndexHtml(fedOptions);

  return output;
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

  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  const updatedContent = indexContent.replace(
    '</body>',
    `${htmlFragment}</body>`
  );
  fs.writeFileSync(indexPath, updatedContent, 'utf-8');
}

async function build(
  config: NormalizedFederationConfig,
  options: Schema,
  context: BuilderContext
) {
  const esbuildConfiguration: ExecutionTransformer<BuildOptions> = (
    options
  ) => {
    options.plugins = [
      ...options.plugins,
      createSharedMappingsPlugin(config.sharedMappings),
    ];
    return options;
  };

  // TODO: Remove cast to any after updating version
  const output = await buildEsbuildBrowser(options, context as any, {
    esbuildConfiguration,
  });
  return output;
}

function infereConfigPath(tsConfig: string): string {
  const relProjectPath = path.dirname(tsConfig);
  const relConfigPath = path.join(relProjectPath, 'federation.config.js');

  return relConfigPath;
}
