import * as path from 'path';
import * as fs from 'fs';
import { NormalizedFederationConfig } from '../config/federation-config';
import { bundle } from '../utils/build-utils';
import { SharedInfo } from '@angular-architects/native-federation-runtime';
import { hashFile } from '../utils/hash-file';
import { FederationOptions } from '../core/federation-options';

export async function bundleSharedMappings(
  config: NormalizedFederationConfig,
  fedOptions: FederationOptions,
  externals: string[]): Promise<Array<SharedInfo>> {
  const result: Array<SharedInfo> = [];

  for (const m of config.sharedMappings) {
    const key = m.key.replace(/[^A-Za-z0-9]/g, '_');
    const outFileName = key + '.js';
    const outFilePath = path.join(fedOptions.outputPath, outFileName);

    console.info('Bundling shared mapping', m.key, '...');

    try {
      await bundle({
        entryPoint: m.path,
        tsConfigPath: fedOptions.tsConfig,
        external: externals,
        outfile: outFilePath,
        mappedPaths: [],
      });

      const hash = hashFile(outFilePath);
      const hashedOutFileName = `${key}-${hash}.js`;
      const hashedOutFilePath = path.join(
        fedOptions.outputPath,
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

      // TODO: add logger
      console.error('Error bundling shared mapping ' + m.key);
      console.error(
        `  >> If you don't need this mapping to shared, you can explicity configure the sharedMappings property in your federation.config.js`
      );

      if (fedOptions.verbose) {
        console.error(e);
      }
    }
  }

  return result;
}
