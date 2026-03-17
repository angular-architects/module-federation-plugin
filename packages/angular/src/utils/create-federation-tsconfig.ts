import type { EntryPoint } from '@softarc/native-federation';
import path from 'path';
import fs from 'fs';
import JSON5 from 'json5';
import { isDeepStrictEqual } from 'util';

/**
 * Creates a tsconfig.federation.json that includes the federation entry points.
 */
export function createFederationTsConfig(
  workspaceRoot: string,
  tsConfigPath: string,
  entryPoints: EntryPoint[],
  optimizedMappings?: boolean
): string {
  const fullTsConfigPath = path.join(workspaceRoot, tsConfigPath);
  const tsconfigDir = path.dirname(fullTsConfigPath);

  const tsconfigAsString = fs.readFileSync(fullTsConfigPath, 'utf-8');
  const tsconfig = JSON5.parse(tsconfigAsString);

  tsconfig.files = entryPoints
    .filter(ep => ep.fileName.startsWith('.'))
    .map(ep => path.relative(tsconfigDir, ep.fileName).replace(/\\\\/g, '/'));

  if (optimizedMappings) {
    const filtered = entryPoints
      .filter(ep => !ep.fileName.startsWith('.'))
      .map(ep => path.relative(tsconfigDir, ep.fileName).replace(/\\\\/g, '/'));

    if (!tsconfig.include) {
      tsconfig.include = [];
    }

    for (const ep of filtered) {
      if (!tsconfig.include.includes(ep)) {
        tsconfig.include.push(ep);
      }
    }
  }

  const content = JSON5.stringify(tsconfig, null, 2);

  const tsconfigFedPath = path.join(tsconfigDir, 'tsconfig.federation.json');

  if (!doesFileExistAndJsonEqual(tsconfigFedPath, content)) {
    fs.writeFileSync(tsconfigFedPath, JSON.stringify(tsconfig, null, 2));
  }

  return tsconfigFedPath;
}

function doesFileExistAndJsonEqual(filePath: string, content: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    const currentContent = fs.readFileSync(filePath, 'utf-8');
    const currentJson = JSON5.parse(currentContent);
    const newJson = JSON5.parse(content);

    return isDeepStrictEqual(currentJson, newJson);
  } catch {
    return false;
  }
}
