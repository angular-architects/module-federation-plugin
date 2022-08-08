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

import { bundle } from '../../utils/build-utils';
import { getPackageInfo } from '../../utils/package-info';
import {
  SharedInfo,
  ExposesInfo,
  FederationInfo,
} from '@angular-architects/native-federation-runtime';
import { BuildOptions } from 'esbuild';
import { createSharedMappingsPlugin } from '../../utils/shared-mappings-plugin';
import { hashFile } from '../../utils/hash-file';

const DEFAULT_SKIP_LIST = new Set([
  '@angular-architects/native-federation',
  '@angular-architects/native-federation-runtime',
  'es-module-shims',
]);

export async function runBuilder(
  options: Schema,
  context: BuilderContext
): Promise<BuilderOutput> {
  const config = await loadFederationConfig(options, context);
  const externals = getExternals(config);

  options.externalDependencies = externals;

  const output = await build(config, options, context);

  const exposesInfo = await bundleExposed(config, options, externals);
  const sharedPackageInfo = await bundleShared(
    config,
    options,
    context,
    externals
  );
  const sharedMappingInfo = await bundleSharedMappings(
    config,
    options,
    context,
    externals
  );

  const sharedInfo = [...sharedPackageInfo, ...sharedMappingInfo];

  const federationInfo: FederationInfo = {
    name: config.name,
    shared: sharedInfo,
    exposes: exposesInfo,
  };

  writeFederationInfo(federationInfo, context, options);

  writeImportMap(sharedInfo, context, options);

  updateIndexHtml(context, options);

  return output;
}

export default createBuilder(runBuilder);

function updateIndexHtml(context: BuilderContext, options: Schema) {
  const outputPath = path.join(context.workspaceRoot, options.outputPath);
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

function writeImportMap(
  sharedInfo: SharedInfo[],
  context: BuilderContext,
  options: Schema
) {
  const imports = sharedInfo.reduce((acc, cur) => {
    return {
      ...acc,
      [cur.packageName]: cur.outFileName,
    };
  }, {});

  const importMap = { imports };
  const importMapPath = path.join(
    context.workspaceRoot,
    options.outputPath,
    'importmap.json'
  );
  fs.writeFileSync(importMapPath, JSON.stringify(importMap, null, 2));
}

function writeFederationInfo(
  federationInfo: FederationInfo,
  context: BuilderContext,
  options: Schema
) {
  const metaDataPath = path.join(
    context.workspaceRoot,
    options.outputPath,
    'remoteEntry.json'
  );
  fs.writeFileSync(metaDataPath, JSON.stringify(federationInfo, null, 2));
}

async function bundleShared(
  config: NormalizedFederationConfig,
  options: Schema,
  context: BuilderContext,
  externals: string[]
): Promise<Array<SharedInfo>> {
  const result: Array<SharedInfo> = [];

  const packageInfos = Object.keys(config.shared)
    .map((packageName) => getPackageInfo(packageName, context))
    .filter((pi) => pi && !DEFAULT_SKIP_LIST.has(pi.packageName));

  for (const pi of packageInfos) {
    console.info('Bundling shared package', pi.packageName, '...');

    const encName = pi.packageName.replace(/[^A-Za-z0-9]/g, '_');
    const encVersion = pi.version.replace(/[^A-Za-z0-9]/g, '_');

    const outFileName = `${encName}-${encVersion}.js`;

    const cachePath = path.join(
      context.workspaceRoot,
      'node_modules/.cache/native-federation'
    );

    fs.mkdirSync(cachePath, { recursive: true });

    const cachedFile = path.join(cachePath, outFileName);

    if (!fs.existsSync(cachedFile)) {
      await bundle({
        entryPoint: pi.entryPoint,
        tsConfigPath: options.tsConfig,
        external: externals,
        outfile: cachedFile,
        mappedPaths: config.sharedMappings,
        useSharedMappingPlugin: true,
      });
    }

    const shared = config.shared[pi.packageName];

    result.push({
      packageName: pi.packageName,
      outFileName: outFileName,
      requiredVersion: shared.requiredVersion,
      singleton: shared.singleton,
      strictVersion: shared.strictVersion,
      version: pi.version,
    });

    const fullOutputPath = path.join(
      context.workspaceRoot,
      options.outputPath,
      outFileName
    );
    fs.copyFileSync(cachedFile, fullOutputPath);
    copySrcMapIfExists(cachedFile, fullOutputPath);
  }

  return result;
}

function copySrcMapIfExists(cachedFile: string, fullOutputPath: string) {
  const mapSrc = cachedFile + '.map';
  const mapDest = fullOutputPath + '.map';

  if (fs.existsSync(mapSrc)) {
    fs.copyFileSync(mapSrc, mapDest);
  }
}

async function bundleSharedMappings(
  config: NormalizedFederationConfig,
  options: Schema,
  context: BuilderContext,
  externals: string[]
): Promise<Array<SharedInfo>> {
  const result: Array<SharedInfo> = [];

  for (const m of config.sharedMappings) {
    const key = m.key.replace(/[^A-Za-z0-9]/g, '_');
    const outFileName = key + '.js';
    const outFilePath = path.join(options.outputPath, outFileName);

    console.info('Bundling shared mapping', m.key, '...');

    try {
      await bundle({
        entryPoint: m.path,
        tsConfigPath: options.tsConfig,
        external: externals,
        outfile: outFilePath,
        mappedPaths: config.sharedMappings,
        useSharedMappingPlugin: false,
      });

      const hash = hashFile(outFilePath);
      const hashedOutFileName = `${key}-${hash}.js`;
      const hashedOutFilePath = path.join(
        options.outputPath,
        hashedOutFileName
      );
      fs.renameSync(outFilePath, hashedOutFilePath);

      result.push({
        packageName: m.key,
        outFileName: hashedOutFileName,
        requiredVersion: '',
        singleton: true,
        strictVersion: false,
        version: '',
      });
    } catch (e) {
      context.logger.error('Error bundling shared mapping ' + m.key);
      context.logger.error(
        `  >> If you don't need this mapping to shared, you can explicity configure the sharedMappings property in your federation.config.js`
      );

      if (options.verbose) {
        console.error(e);
      }
    }
  }

  return result;
}

async function bundleExposed(
  config: NormalizedFederationConfig,
  options: Schema,
  externals: string[]
): Promise<Array<ExposesInfo>> {
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
      outfile: outFilePath,
      mappedPaths: config.sharedMappings,
      useSharedMappingPlugin: true,
    });

    const hash = hashFile(outFilePath);
    const hashedOutFileName = `${key}-${hash}.js`;
    const hashedOutFilePath = path.join(options.outputPath, hashedOutFileName);
    fs.renameSync(outFilePath, hashedOutFilePath);

    result.push({ key, outFileName: hashedOutFileName });
  }
  return result;
}

function getExternals(config: NormalizedFederationConfig) {
  const shared = Object.keys(config.shared);
  const sharedMappings = config.sharedMappings.map((m) => m.key);

  const externals = [...shared, ...sharedMappings];

  return externals.filter((p) => !DEFAULT_SKIP_LIST.has(p));
}

async function loadFederationConfig(options: Schema, context: BuilderContext) {
  const relProjectPath = path.dirname(options.tsConfig);
  const fullProjectPath = path.join(context.workspaceRoot, relProjectPath);
  const fullConfigPath = path.join(fullProjectPath, 'federation.config.js');

  if (!fs.existsSync(fullConfigPath)) {
    throw new Error('Expected ' + fullConfigPath);
  }

  const config = (await import(fullConfigPath)) as NormalizedFederationConfig;
  return config;
}
