import * as path from 'path';
import * as fs from 'fs';
import { NormalizedFederationConfig } from '../config/federation-config';
import { bundle } from '../utils/build-utils';
import { ExposesInfo } from '@angular-architects/native-federation-runtime';
import { hashFile } from '../utils/hash-file';
import { FederationOptions } from './federation-options';

export async function bundleExposed(
  config: NormalizedFederationConfig,
  options: FederationOptions,
  externals: string[]): Promise<Array<ExposesInfo>> {
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
    });

    const hash = hashFile(outFilePath);
    const hashedOutFileName = `${key}-${hash}.js`;
    const hashedOutFilePath = path.join(options.outputPath, hashedOutFileName);
    fs.renameSync(outFilePath, hashedOutFilePath);

    result.push({ key, outFileName: hashedOutFileName });
  }
  return result;
}
