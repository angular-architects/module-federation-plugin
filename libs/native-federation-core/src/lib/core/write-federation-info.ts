import { FederationInfo } from '@softarc/native-federation-runtime';
import * as fs from 'fs';
import * as path from 'path';
import { FederationOptions } from './federation-options';

export function writeFederationInfo(
  federationInfo: FederationInfo,
  fedOptions: FederationOptions
) {
  const metaDataPath = path.join(
    fedOptions.workspaceRoot,
    fedOptions.outputPath,
    'remoteEntry.json'
  );
  fs.writeFileSync(metaDataPath, JSON.stringify(federationInfo, null, 2));
}
