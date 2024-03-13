import * as path from 'path';
import * as fs from 'fs';
import { FederationInfo } from '@softarc/native-federation-runtime';
import { FederationOptions } from './federation-options';

export function writeImportMap(
  { name, shared, exposes }: FederationInfo,
  fedOption: FederationOptions
) {
  const sharedImports = shared.reduce((acc, cur) => {
    return {
      ...acc,
      [cur.packageName]: `./${cur.outFileName}`,
    };
  }, {});

  const exposesImports = exposes.reduce((acc, cur) => {
    return {
      ...acc,
      [`${name}/${cur.key}`]: `./${cur.outFileName}`,
    };
  }, {});

  const importMap = { imports: { ...sharedImports, ...exposesImports } };
  const importMapPath = path.join(
    fedOption.workspaceRoot,
    fedOption.outputPath,
    'importmap.json'
  );
  fs.writeFileSync(importMapPath, JSON.stringify(importMap, null, 2));
}
