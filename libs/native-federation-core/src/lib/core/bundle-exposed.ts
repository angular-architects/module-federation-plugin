import * as path from 'path';
import * as fs from 'fs';
import { NormalizedFederationConfig } from '../config/federation-config';
import { bundle } from '../utils/build-utils';
import { ExposesInfo } from '@softarc/native-federation-runtime';
import { hashFile } from '../utils/hash-file';
import { FederationOptions } from './federation-options';
import { logger } from '../utils/logger';
import { normalize } from '../utils/normalize';

export async function bundleExposed(
  config: NormalizedFederationConfig,
  options: FederationOptions,
  externals: string[]
): Promise<Array<ExposesInfo>> {
  const result: Array<ExposesInfo> = [];

  for (const key in config.exposes) {
    const outFileName = key + '.js';
    const outFilePath = path.join(options.outputPath, outFileName);
    const entryPoint = config.exposes[key];

    const localPath = normalize(
      path.join(options.workspaceRoot, config.exposes[key])
    );

    logger.info(`Bundling exposed module ${entryPoint}`);

    try {
      await bundle({
        entryPoint,
        tsConfigPath: options.tsConfig,
        external: externals,
        outfile: outFilePath,
        watch: options.watch,
        mappedPaths: config.sharedMappings,
        kind: 'exposed',
      });

      let finalOutFileName = outFileName;
      if (!options.watch) {
        const hash = hashFile(outFilePath);
        finalOutFileName = `${key}-${hash}.js`;
        const hashedOutFilePath = path.join(
          options.outputPath,
          finalOutFileName
        );
        fs.renameSync(outFilePath, hashedOutFilePath);
      }

      result.push({
        key,
        outFileName: finalOutFileName,
        dev: !options.dev
          ? undefined
          : {
              entryPoint: localPath,
            },
      });
    } catch (e) {
      logger.error('Error bundling exposed module ' + entryPoint);
      logger.notice(
        'Please check the `exposes` section in your federation.config.js'
      );
      logger.error(e);
    }
  }
  return result;
}

export function describeExposed(
  config: NormalizedFederationConfig,
  options: FederationOptions
): Array<ExposesInfo> {
  const result: Array<ExposesInfo> = [];

  for (const key in config.exposes) {
    const localPath = normalize(
      path.join(options.workspaceRoot, config.exposes[key])
    );

    result.push({
      key,
      outFileName: '',
      dev: !options.dev
        ? undefined
        : {
            entryPoint: localPath,
          },
    });
  }

  return result;
}
