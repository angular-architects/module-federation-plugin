import { register } from "node:module";
import { pathToFileURL } from "node:url";
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { processHostInfo, processRemoteInfos, FederationInfo } from "@softarc/native-federation-runtime";
import { ImportMap, mergeImportMaps } from "@softarc/native-federation-runtime";
import { setImportMap } from "./import-map-store";

export type InitNodeFederationOptions = {
  relBundlePath: string;
};

export async function initNodeFederation(
  remotesOrManifestUrl: Record<string, string> | string = {},
  options: InitNodeFederationOptions
): Promise<void> {
  const importMap = await createNodeImportMap(remotesOrManifestUrl, options);
  setImportMap(importMap);
  register(pathToFileURL('./federation-resolver.js').href);
}

async function createNodeImportMap(
  remotesOrManifestUrl: Record<string, string> | string = {},
  options: InitNodeFederationOptions
): Promise<ImportMap> {
  const remotes =
    typeof remotesOrManifestUrl === 'object'
      ? remotesOrManifestUrl
      : await loadFsManifest(options.relBundlePath, remotesOrManifestUrl);

  const hostInfo = await loadFsFederationInfo(options.relBundlePath);
  const hostImportMap = await processHostInfo(hostInfo, options.relBundlePath);
  const remotesImportMap = await processRemoteInfos(remotes);

  const importMap = mergeImportMaps(hostImportMap, remotesImportMap);

  return importMap;
}

async function loadFsManifest(
  relBundlePath: string,
  manifestName: string
): Promise<Record<string, string>> {
  const manifestPath = path.join(relBundlePath, manifestName);
  const content = await fs.readFile(manifestPath, 'utf-8');
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
