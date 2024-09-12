import {
  getModuleNameByUrl,
  hasRemoteSsr,
  loadModule,
  setManifestObjectForSsr,
} from '@angular-architects/native-federation';
import { ImportMap } from '@jspm/import-map';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import manifest from './assets/federation.manifest.json';

setManifestObjectForSsr(manifest);

export type Context = {
  parentURL?: string;
};

export type NextResolve = (
  specifier: string,
  context: Context,
  nextResolve: NextResolve
) => Promise<string | unknown>;
export type DefaultLoad = (
  specifier: string,
  context: Context,
  defaultLoad: DefaultLoad
) => Promise<string | unknown>;

const toImportJson = join(
  dirname(fileURLToPath(import.meta.url)),
  'importmap.json'
);
const importmapJson = JSON.parse(readFileSync(toImportJson, 'utf8'));

const importMap = new ImportMap({ map: {}, mapUrl: import.meta.url });

const resolveModulePath = (
  specifier: string,
  cacheMapPath: string
): string | null => {
  try {
    return importMap.resolve(specifier, cacheMapPath);
  } catch {
    return null;
  }
};

export const checkIfNodeProtocol = (modulePath: string) => {
  const { protocol = '' } = new URL(modulePath);
  return protocol === 'node:';
};

export const checkIfFileProtocol = (modulePath: string) => {
  const { protocol = '' } = new URL(modulePath);
  return protocol === 'file:';
};

export async function resolve(
  specifier: string,
  context: Context,
  nextResolve: NextResolve
) {
  let { parentURL } = context;

  // if (specifier.indexOf('@angular/platform-browser') > -1) {
  //   specifier = '@angular/platform-browser'
  //   parentURL = import.meta.url
  //   run = true;
  // }
  //
  // if (!run) return nextResolve(specifier, context, nextResolve);

  if (!parentURL) return nextResolve(specifier, context, nextResolve);
  if (hasRemoteSsr(parentURL)) {
    parentURL = import.meta.url;
    context.parentURL = parentURL;
  }

  const modulePath = resolveModulePath(specifier, parentURL);

  if (!modulePath) return nextResolve(specifier, context, nextResolve);
  if (checkIfNodeProtocol(modulePath))
    return nextResolve(modulePath, context, nextResolve);
  if (checkIfFileProtocol(modulePath))
    return nextResolve(modulePath, context, nextResolve);

  // console.log('resolve', specifier, importMap.resolve(specifier, parentURL));
  // console.log('resolve',specifier);
  if (hasRemoteSsr(specifier)) {
    return {
      url: specifier,
      shortCircuit: true,
    };
  }

  return nextResolve(specifier, context, nextResolve);
}

export async function load(
  url: string,
  context: Context,
  defaultLoad: DefaultLoad
) {
  if (hasRemoteSsr(url)) {
    const [response, moduleName] = await Promise.all([
      await loadModule(url),
      await getModuleNameByUrl(url),
    ]);

    return {
      format: 'module',
      source: response,
      shortCircuit: true,
    };
  }
  return defaultLoad(url, context, defaultLoad);
}
