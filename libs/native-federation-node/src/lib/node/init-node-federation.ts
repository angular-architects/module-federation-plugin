import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {
  FederationInfo,
  ImportMap,
  InitFederationOptions,
  mergeImportMaps,
  processHostInfo,
  processRemoteInfos,
} from '@softarc/native-federation-runtime';
import { IMPORT_MAP_FILE_NAME } from '../utils/import-map-loader';
import { resolver } from '../utils/loader-as-data-url';

export type InitNodeFederationOptions = {
  remotesOrManifestUrl: Record<string, string> | string;
  relBundlePath: string;
  throwIfRemoteNotFound: boolean;
  cacheTag?: string;
};

const defaultOptions: InitNodeFederationOptions = {
  remotesOrManifestUrl: {},
  relBundlePath: '../browser',
  throwIfRemoteNotFound: false,
};

export async function initNodeFederation(
  options: Partial<InitNodeFederationOptions>
): Promise<void> {
  const mergedOptions = { ...defaultOptions, ...options };
  const importMap = await createNodeImportMap(mergedOptions);

  // const normalized = resolveAndComposeImportMap(importMap) as ImportMap;
  // await writeImportMap(normalized);

  await writeImportMap(importMap);
  await writeResolver();

  register(pathToFileURL('./federation-resolver.mjs').href);
}

async function createNodeImportMap(
  options: InitNodeFederationOptions
): Promise<ImportMap> {
  const { remotesOrManifestUrl, relBundlePath } = options;

  const remotes =
    typeof remotesOrManifestUrl === 'object'
      ? remotesOrManifestUrl
      : await loadFsManifest(remotesOrManifestUrl);

  const hostInfo = await loadFsFederationInfo(relBundlePath);
  const hostImportMap = await processHostInfo(hostInfo, relBundlePath);
  const remotesImportMap = await processRemoteInfos(remotes, {
    throwIfRemoteNotFound: options.throwIfRemoteNotFound,
    cacheTag: options.cacheTag,
  });

  const importMap = mergeImportMaps(hostImportMap, remotesImportMap);

  return importMap;
}

async function loadFsManifest(
  manifestUrl: string
): Promise<Record<string, string>> {
  const content = await fs.readFile(manifestUrl, 'utf-8');
  const manifest = JSON.parse(content) as Record<string, string>;
  return manifest;
}

async function loadFsFederationInfo(
  relBundlePath: string
): Promise<FederationInfo> {
  const manifestPath = path.join(relBundlePath, 'remoteEntry.json');
  const content = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(content) as FederationInfo;
  return manifest;
}

async function writeImportMap(map: ImportMap): Promise<void> {
  await fs.writeFile(
    IMPORT_MAP_FILE_NAME,
    JSON.stringify(map, null, 2),
    'utf-8'
  );
}

async function writeResolver() {
  const buffer = Buffer.from(resolver, 'base64');
  await fs.writeFile('federation-resolver.mjs', buffer, 'utf-8');
}
