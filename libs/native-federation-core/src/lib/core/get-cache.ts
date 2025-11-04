import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { NormalizedSharedConfig } from '../config/federation-config';
import { SharedInfo } from '@softarc/native-federation-runtime';

export const getCachePath = (workspaceRoot: string, project: string) =>
  path.join(workspaceRoot, 'node_modules/.cache/native-federation', project);

export const getChecksum = (
  shared: Record<string, NormalizedSharedConfig>
): string => {
  const denseExternals = Object.keys(shared)
    .sort()
    .reduce((clean, external) => {
      return (
        clean +
        ':' +
        external +
        (shared[external].version ? `@${shared[external].version}` : '')
      );
    }, 'deps');

  return crypto.createHash('sha256').update(denseExternals).digest('hex');
};

export const getCachedMetadata = (
  pathToCache: string,
  checksum: string
): SharedInfo[] => {
  const metadataFile = path.join(pathToCache, 'metadata.json');
  if (!fs.existsSync(metadataFile)) return [];

  const cachedResult: { checksum: string; externals: SharedInfo[] } =
    JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
  if (cachedResult.checksum !== checksum) return [];
  return cachedResult.externals;
};

export const storeCachedMetadata = (
  pathToCache: string,
  checksum: string,
  externals: SharedInfo[]
) => {
  fs.writeFileSync(
    path.join(pathToCache, 'metadata.json'),
    JSON.stringify({ checksum, externals }, undefined, 2),
    'utf-8'
  );
};

export const copyCacheToDist = (
  pathToCache: string,
  fullOutputPath: string
) => {
  fs.readdirSync(pathToCache).forEach((file) => {
    if (file === 'metadata.json') return;
    const cachedFile = path.join(pathToCache, file);
    const distFileName = path.join(fullOutputPath, file);

    if (fs.existsSync(cachedFile)) {
      fs.copyFileSync(cachedFile, distFileName);
    }
    console.log(file);
  });
  fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true });
};

export const purgeCacheFolder = (pathToCache: string) => {
  if (!fs.existsSync(pathToCache)) return;

  try {
    fs.rmSync(pathToCache, { recursive: true, force: true });
  } catch (error) {
    // Fallback for older Node.js versions or if rmSync fails
    try {
      fs.rmdirSync(pathToCache, { recursive: true });
    } catch (fallbackError) {
      console.warn(
        `Failed to purge cache folder: ${pathToCache}`,
        fallbackError
      );
    }
  }
};
