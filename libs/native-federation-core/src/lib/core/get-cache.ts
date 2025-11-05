import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { NormalizedSharedConfig } from '../config/federation-config';
import { SharedInfo } from '@softarc/native-federation-runtime';
import { logger } from '../utils/logger';

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
  file: string,
  checksum: string
): SharedInfo[] | false => {
  const metadataFile = path.join(pathToCache, file);
  if (!fs.existsSync(metadataFile)) return false;

  const cachedResult: {
    checksum: string;
    externals: SharedInfo[];
    files: string[];
  } = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
  if (cachedResult.checksum !== checksum) return false;
  return cachedResult.externals;
};

export const storeCachedMetadata = (
  pathToCache: string,
  file: string,
  payload: { checksum: string; externals: SharedInfo[]; files: string[] }
) => {
  fs.writeFileSync(
    path.join(pathToCache, file),
    JSON.stringify(payload, undefined, 2),
    'utf-8'
  );
};

export const copyCacheToDist = (
  pathToCache: string,
  file: string,
  fullOutputPath: string
) => {
  const metadataFile = path.join(pathToCache, file);
  if (!fs.existsSync(metadataFile))
    throw new Error(
      'Error copying artifacts to dist, metadata file could not be found.'
    );

  const cachedResult: {
    checksum: string;
    externals: SharedInfo[];
    files: string[];
  } = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));

  fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true });

  cachedResult.files.forEach((file) => {
    const cachedFile = path.join(pathToCache, file);
    const distFileName = path.join(fullOutputPath, file);

    if (fs.existsSync(cachedFile)) {
      fs.copyFileSync(cachedFile, distFileName);
    }
  });
};

export const purgeCacheFolder = (pathToCache: string, file: string) => {
  const metadataFile = path.join(pathToCache, file);
  if (!fs.existsSync(metadataFile)) {
    logger.warn(
      `Could not purge cache, metadata file '${file}' could not be found.`
    );
  }

  const cachedResult: {
    checksum: string;
    externals: SharedInfo[];
    files: string[];
  } = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));

  cachedResult.files.forEach((file) => {
    const cachedFile = path.join(pathToCache, file);

    if (fs.existsSync(cachedFile)) fs.unlinkSync(cachedFile);
  });
};
