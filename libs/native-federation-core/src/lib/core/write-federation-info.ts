import * as path from 'path';
import * as fs from 'fs';
import { FederationInfo } from '@softarc/native-federation-runtime';
import { FederationOptions } from './federation-options';

export function writeFederationInfo(
  federationInfo: FederationInfo,
  fedOptions: FederationOptions
) {
  if (!fedOptions.locales?.length) {
    const metaDataPath = path.join(
      fedOptions.workspaceRoot,
      fedOptions.outputPath,
      'remoteEntry.json'
    );
    fs.writeFileSync(metaDataPath, JSON.stringify(federationInfo, null, 2));
  } else {
    for (const locale of fedOptions.locales) {
      const metaDataPath = path.join(
        fedOptions.workspaceRoot,
        fedOptions.outputPath,
        locale,
        'remoteEntry.json');
      fs.writeFileSync(metaDataPath, JSON.stringify(federationInfo, null, 2));
    }
  }
}
