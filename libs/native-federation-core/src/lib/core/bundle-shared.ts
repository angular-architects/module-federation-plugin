import * as path from 'path';
import * as fs from 'fs';
import { NormalizedFederationConfig } from '../config/federation-config';
import { bundle } from '../utils/build-utils';
import { getPackageInfo, PackageInfo } from '../utils/package-info';
import { SharedInfo } from '@softarc/native-federation-runtime';
import { FederationOptions } from './federation-options';
import { DEFAULT_SKIP_LIST } from "./default-skip-list";
import { copySrcMapIfExists } from '../utils/copy-src-map-if-exists';

export async function bundleShared(
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  externals: string[]): Promise<Array<SharedInfo>> {
  const result: Array<SharedInfo> = [];

  const packageInfos = Object.keys(config.shared)
    .filter(packageName => !DEFAULT_SKIP_LIST.has(packageName))
    .map(packageName => getPackageInfo(packageName, fedOptions.workspaceRoot))
    .filter((pi) => !!pi) as PackageInfo[];

  for (const pi of packageInfos) {

    // TODO: add logger
    console.info('Bundling shared package', pi.packageName, '...');

    const encName = pi.packageName.replace(/[^A-Za-z0-9]/g, '_');
    const encVersion = pi.version.replace(/[^A-Za-z0-9]/g, '_');

    const outFileName = `${encName}-${encVersion}.js`;

    const cachePath = path.join(
      fedOptions.workspaceRoot,
      'node_modules/.cache/native-federation'
    );

    fs.mkdirSync(cachePath, { recursive: true });

    const cachedFile = path.join(cachePath, outFileName);

    if (!fs.existsSync(cachedFile)) {
      await bundle({
        entryPoint: pi.entryPoint,
        tsConfigPath: fedOptions.tsConfig,
        external: externals,
        outfile: cachedFile,
        mappedPaths: config.sharedMappings,
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
      fedOptions.workspaceRoot,
      fedOptions.outputPath,
      outFileName
    );
    fs.copyFileSync(cachedFile, fullOutputPath);
    copySrcMapIfExists(cachedFile, fullOutputPath);
  }

  return result;
}
