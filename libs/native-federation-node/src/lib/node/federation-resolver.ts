import { URL } from 'url';
import { resolveAndComposeImportMap } from '../utils/import-map-utils';

console.log('resolveAndComposeImportMap', resolveAndComposeImportMap);

interface ResolveContext {
  conditions: string[];
  importAssertions: Record<string, string>;
  parentURL?: string;
}

interface LoadContext {
  format: string | null;
  importAssertions: Record<string, string>;
}

interface ResolveResult {
  url: string;
}

interface LoadResult {
  format: string;
  source: string | ArrayBuffer | Uint8Array;
}

type ResolveFunction = (
  specifier: string,
  context: ResolveContext,
  defaultResolve: (specifier: string, context: ResolveContext) => Promise<ResolveResult>
) => Promise<ResolveResult>;

type LoadFunction = (
  url: string,
  context: LoadContext,
  defaultLoad: (url: string, context: LoadContext) => Promise<LoadResult>
) => Promise<LoadResult>;

export const resolve: ResolveFunction = async (specifier, context, defaultResolve) => {
  console.log(`Resolving: ${specifier}`);
  
  return defaultResolve(specifier, context);
};

export const load: LoadFunction = async (url, context, defaultLoad) => {
  console.log(`Loading: ${url}`);

  return defaultLoad(url, context);
};
