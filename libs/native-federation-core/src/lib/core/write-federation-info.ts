import * as path from 'path';
import * as fs from 'fs';
import { FederationInfo } from '@softarc/native-federation-runtime';
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
  const metaDataPathServer = path.join(
    fedOptions.workspaceRoot,
    fedOptions.outputPathServer,
    'remoteEntry.json'
  );
  fs.writeFileSync(metaDataPath, JSON.stringify(federationInfo, null, 2));
  fs.writeFileSync(metaDataPathServer, JSON.stringify(federationInfo, null, 2));
}
