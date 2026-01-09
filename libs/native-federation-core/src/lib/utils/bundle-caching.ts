import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { NormalizedSharedConfig } from '../config/federation-config';
import { SharedInfo } from '@softarc/native-federation-runtime';
import { logger } from '../utils/logger';

export const getCachePath = (workspaceRoot: string, project: string) =>
  path.join(workspaceRoot, 'node_modules/.cache/native-federation', project);

export const getFilename = (title: string, dev?: boolean) => {
  const devSuffix = dev ? '-dev' : '';
  return `${title}${devSuffix}.meta.json`;
};

export const getChecksum = (
  shared: Record<string, NormalizedSharedConfig>,
  dev: '1' | '0',
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

  return crypto
    .createHash('sha256')
    .update(denseExternals + `:dev=${dev}`)
    .digest('hex');
};

export const cacheEntry = (pathToCache: string, fileName: string) => ({
  getMetadata: (
    checksum: string,
  ):
    | {
        checksum: string;
        externals: SharedInfo[];
        files: string[];
      }
    | undefined => {
    const metadataFile = path.join(pathToCache, fileName);
    if (!fs.existsSync(pathToCache) || !fs.existsSync(metadataFile))
      return undefined;

    const cachedResult: {
      checksum: string;
      externals: SharedInfo[];
      files: string[];
    } = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
    if (cachedResult.checksum !== checksum) return undefined;
    return cachedResult;
  },
  persist: (payload: {
    checksum: string;
    externals: SharedInfo[];
    files: string[];
  }) => {
    fs.writeFileSync(
      path.join(pathToCache, fileName),
      JSON.stringify(payload),
      'utf-8',
    );
  },
  copyFiles: (fullOutputPath: string) => {
    const metadataFile = path.join(pathToCache, fileName);
    if (!fs.existsSync(metadataFile))
      throw new Error(
        'Error copying artifacts to dist, metadata file could not be found.',
      );

    const cachedResult: {
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
  },
  clear: () => {
    const metadataFile = path.join(pathToCache, fileName);
    if (!fs.existsSync(pathToCache)) {
      fs.mkdirSync(pathToCache, { recursive: true });
      logger.debug(`Creating cache folder '${pathToCache}' for '${fileName}'.`);
      return;
    }
    if (!fs.existsSync(metadataFile)) return;

    logger.debug(`Purging cached bundle '${metadataFile}'.`);

    const cachedResult: {
      checksum: string;
      externals: SharedInfo[];
      files: string[];
    } = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));

    cachedResult.files.forEach((file) => {
      const cachedFile = path.join(pathToCache, file);
      if (fs.existsSync(cachedFile)) fs.unlinkSync(cachedFile);
    });

    fs.unlinkSync(metadataFile);
  },
});
