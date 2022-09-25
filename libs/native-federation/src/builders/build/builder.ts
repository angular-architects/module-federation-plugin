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
import {
  hashFile,
  logger,
  NormalizedFederationConfig,
  setLogLevel,
} from '@softarc/native-federation/build';

import { BuildOptions } from 'esbuild';
import { createSharedMappingsPlugin } from '../../utils/shared-mappings-plugin';
import { FederationOptions } from '@softarc/native-federation/build';
import { setBuildAdapter } from '@softarc/native-federation/build';
import { AngularEsBuildAdapter } from '../../utils/angular-esbuild-adapter';
import { getExternals } from '@softarc/native-federation/build';
import { loadFederationConfig } from '@softarc/native-federation/build';
import { buildForFederation } from '@softarc/native-federation/build';

import * as crossSpawn from 'cross-spawn';

export async function runBuilder(
  options: Schema,
  context: BuilderContext
): Promise<BuilderOutput> {
  setBuildAdapter(AngularEsBuildAdapter);
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

  runNgccIfNeeded(fedOptions, fedOptions.workspaceRoot);

  options.externalDependencies = externals.filter((e) => e !== 'tslib');
  const output = await build(config, options, context);

  await buildForFederation(config, fedOptions, externals);

  updateIndexHtml(fedOptions);

  return output;
}

export default createBuilder(runBuilder);

function runNgccIfNeeded(fedOptions: FederationOptions, workspaceRoot: string) {
  const hash = getLockFileHash(fedOptions);
  const skip = skipNgcc(hash, workspaceRoot);

  if (!skip) {
    runNgcc(workspaceRoot);
    writeNgccLock(hash, workspaceRoot);
  }
}

function runNgcc(workspaceRoot: string) {
  logger.verbose('Running ngcc');
  const command = getNpxCommand(workspaceRoot);
  const result = crossSpawn.sync(
    command,
    ['ngcc', '--async', '--create-ivy-entry-points', '--first-only'],
    { stdio: 'inherit' }
  );

  if (result.status !== 0) {
    const error = result.error || '';
    logger.error('Error running ngcc: ' + error);
  }
}

function getLockFileHash(fedOptions: FederationOptions) {
  const lockFileName = getLockFileName(fedOptions.workspaceRoot);
  const hash = hashFile(lockFileName);
  return hash;
}

const NGCC_LOCK_DIR = 'node_modules/.cache/native-federation/ngcc';

function skipNgcc(hash: string, workspaceRoot: string) {
  const ngccLockFileDir = path.join(workspaceRoot, NGCC_LOCK_DIR);
  const ngccLockFileName = path.join(ngccLockFileDir, hash + '.lock');

  let exists = false;
  if (fs.existsSync(ngccLockFileName)) {
    exists = true;
  }
  return exists;
}

function writeNgccLock(hash: string, workspaceRoot: string) {
  const ngccLockFileDir = path.join(workspaceRoot, NGCC_LOCK_DIR);
  const ngccLockFileName = path.join(ngccLockFileDir, hash + '.lock');

  if (!fs.existsSync(ngccLockFileDir)) {
    fs.mkdirSync(ngccLockFileDir, { recursive: true });
  }

  fs.writeFileSync(ngccLockFileName, '');
}

function getLockFileName(workspaceRoot: string) {
  let candPath = '';
  for (const candLock of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']) {
    candPath = path.join(workspaceRoot, candLock);
    if (fs.existsSync(candPath)) {
      break;
    }
  }
  return candPath;
}

function getNpxCommand(workspaceRoot: string): string {
  switch (getLockFileName(workspaceRoot)) {
    case 'package-lock.json':
      return 'npx';
    case 'yarn.lock':
      return 'yarn';
    case 'pnpm-lock.yaml':
      return 'pnpx';
    default:
      return 'npx';
  }
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

function infereConfigPath(tsConfig: string): string {
  const relProjectPath = path.dirname(tsConfig);
  const relConfigPath = path.join(relProjectPath, 'federation.config.js');

  return relConfigPath;
}
