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
import { NormalizedFederationConfig } from '../../config/federation-config';

import {
  FederationInfo,
} from '@angular-architects/native-federation-runtime';
import { BuildOptions } from 'esbuild';
import { createSharedMappingsPlugin } from '../../utils/shared-mappings-plugin';
import { FederationOptions } from '../../core/federation-options';
import { setBuildAdapter } from '../../core/build-adapter';
import { AngularEsBuildAdapter } from '../../utils/angular-esbuild-adapter';
import { writeImportMap } from '../../core/write-import-map';
import { writeFederationInfo } from '../../core/write-federation-info';
import { bundleShared } from '../../core/bundle-shared';
import { bundleSharedMappings } from '../../core/bundle-shared-mappings';
import { bundleExposed } from '../../core/bundle-exposed';
import { getExternals } from '../../core/get-externals';
import { loadFederationConfig } from '../../core/load-federation-config';

export async function runBuilder(
  options: Schema,
  context: BuilderContext
): Promise<BuilderOutput> {

  setBuildAdapter(AngularEsBuildAdapter);

  const fedOptions: FederationOptions = {
    workspaceRoot: context.workspaceRoot,
    outputPath: options.outputPath,
    tsConfig: options.tsConfig,
    verbose: options.verbose
  }

  const config = await loadFederationConfigByConvention(fedOptions);
  const externals = getExternals(config);

  options.externalDependencies = externals;
  const output = await build(config, options, context);

  await buildForFederation(config, fedOptions, externals);

  updateIndexHtml(fedOptions);

  return output;
}

export default createBuilder(runBuilder);

async function buildForFederation(config: NormalizedFederationConfig, fedOptions: FederationOptions, externals: string[]) {
  const exposedInfo = await bundleExposed(config, fedOptions, externals);

  const sharedPackageInfo = await bundleShared(
    config,
    fedOptions,
    externals
  );

  const sharedMappingInfo = await bundleSharedMappings(
    config,
    fedOptions,
    externals
  );

  const sharedInfo = [...sharedPackageInfo, ...sharedMappingInfo];

  const federationInfo: FederationInfo = {
    name: config.name,
    shared: sharedInfo,
    exposes: exposedInfo,
  };

  writeFederationInfo(federationInfo, fedOptions);

  writeImportMap(sharedInfo, fedOptions);
}

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

async function loadFederationConfigByConvention(fedOption: FederationOptions) {
  const relProjectPath = path.dirname(fedOption.tsConfig);
  const fullProjectPath = path.join(fedOption.workspaceRoot, relProjectPath);
  const fullConfigPath = path.join(fullProjectPath, 'federation.config.js');

  if (!fs.existsSync(fullConfigPath)) {
    throw new Error('Expected ' + fullConfigPath);
  }

  return await loadFederationConfig(fullConfigPath);
}
