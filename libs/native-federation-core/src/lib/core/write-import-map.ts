import * as path from 'path';
import * as fs from 'fs';
import { SharedInfo } from '@softarc/native-federation-runtime';
import { FederationOptions } from './federation-options';

export function writeImportMap(
  sharedInfo: SharedInfo[],
  fedOption: FederationOptions
) {
  const imports = sharedInfo.reduce((acc, cur) => {
    return {
      ...acc,
      [cur.packageName]: cur.outFileName,
    };
  }, {});

  const importMap = { imports };
  const importMapPath = path.join(
    fedOption.workspaceRoot,
    fedOption.outputPath,
    'importmap.json'
  );
  const importMapPathServer = path.join(
    fedOption.workspaceRoot,
    fedOption.outputPathServer,
    'importmap.json'
  );
  fs.writeFileSync(importMapPath, JSON.stringify(importMap, null, 2));
  fs.writeFileSync(importMapPathServer, JSON.stringify(importMap, null, 2));
}
