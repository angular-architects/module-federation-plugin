import path from 'path';
import url from 'url';
import { promises as fs } from 'fs';

export const IMPORT_MAP_FILE_NAME = 'node.importmap';

const baseURL = url.pathToFileURL(process.cwd()) + path.sep;

// https://wicg.github.io/import-maps/#new-resolve-algorithm
export function resolveSpecifier(importMap, specifier, parentURL) {
  let currentBaseURL;
  if (parentURL) {
    const lastSlashIndex = parentURL.lastIndexOf(path.sep);
    currentBaseURL = parentURL.slice(0, lastSlashIndex + 1);
  } else {
    currentBaseURL = baseURL;
  }
  const normalizedSpecifier =
    parseURLLikeSpecifier(specifier, currentBaseURL) || specifier;
  for (let scopePrefix in importMap.scopes) {
    if (
      scopePrefix === currentBaseURL ||
      (scopePrefix.endsWith('/') && currentBaseURL.startsWith(scopePrefix))
    ) {
      const scopeImportsMatch = resolveImportsMatch(
        normalizedSpecifier,
        importMap.scopes[scopePrefix]
      );
      if (scopeImportsMatch) {
        return scopeImportsMatch;
      }
    } else {
      const topLevelImportsMatch = resolveImportsMatch(
        normalizedSpecifier,
        importMap.imports
      );
      if (topLevelImportsMatch) {
        return topLevelImportsMatch;
      }
    }
  }

  return resolveImportsMatch(normalizedSpecifier, importMap.imports);
}

// https://wicg.github.io/import-maps/#resolve-an-imports-match
function resolveImportsMatch(normalizedSpecifier, specifierMap) {
  for (let specifierKey in specifierMap) {
    const resolutionResult = specifierMap[specifierKey];

    if (specifierKey === normalizedSpecifier) {
      if (resolutionResult === null) {
        throw TypeError(
          `The import map resolution of ${specifierKey} failed due to a null entry`
        );
      }
      return resolutionResult;
    } else if (
      specifierKey.endsWith('/') &&
      normalizedSpecifier.startsWith(specifierKey)
    ) {
      if (resolutionResult === null) {
        throw TypeError(
          `The import map resolution of ${specifierKey} failed due to a null entry`
        );
      }
      const afterPrefix = normalizedSpecifier.slice(specifierKey.length);
      try {
        return new URL(afterPrefix, resolutionResult).href;
      } catch {
        throw TypeError(
          `The import map resolution of ${specifierKey} failed due to URL parse failure`
        );
      }
    }
  }

  return null;
}

// https://wicg.github.io/import-maps/#parsing
export function resolveAndComposeImportMap(parsed) {
  // Step 2
  if (!isPlainObject(parsed)) {
    throw Error(`Invalid import map - top level must be an object`);
  }

  // Step 3
  let sortedAndNormalizedImports = {};

  // Step 4
  if (parsed.hasOwnProperty('imports')) {
    // Step 4.1
    if (!isPlainObject(parsed.imports)) {
      throw Error(`Invalid import map - "imports" property must be an object`);
    }

    // Step 4.2
    sortedAndNormalizedImports = sortAndNormalizeSpecifierMap(
      parsed.imports,
      baseURL
    );
  }

  // Step 5
  let sortedAndNormalizedScopes = {};

  // Step 6
  if (parsed.hasOwnProperty('scopes')) {
    // Step 6.1
    if (!isPlainObject(parsed.scopes)) {
      throw Error(`Invalid import map - "scopes" property must be an object`);
    }

    // Step 6.2
    sortedAndNormalizedScopes = sortAndNormalizeScopes(parsed.scopes, baseURL);
  }

  // Step 7
  const invalidKeys = Object.keys(parsed).filter(
    (key) => key !== 'imports' && key !== 'scopes'
  );
  if (invalidKeys.length > 0) {
    console.warn(
      `Invalid top-level key${
        invalidKeys.length > 0 ? 's' : ''
      } in import map - ${invalidKeys.join(', ')}`
    );
  }

  // Step 8
  return {
    imports: sortedAndNormalizedImports,
    scopes: sortedAndNormalizedScopes,
  };
}

// https://wicg.github.io/import-maps/#sort-and-normalize-a-specifier-map
function sortAndNormalizeSpecifierMap(map, baseURL) {
  const normalized = {};

  for (let specifierKey in map) {
    const value = map[specifierKey];

    const normalizedSpecifierKey = normalizeSpecifierKey(specifierKey, baseURL);
    if (normalizedSpecifierKey === null) {
      continue;
    }

    let addressURL = parseURLLikeSpecifier(value, baseURL);
    if (addressURL === null) {
      console.warn(
        `Invalid URL address for import map specifier '${specifierKey}'`
      );
      normalized[normalizedSpecifierKey] = null;
      continue;
    }

    if (specifierKey.endsWith('/') && !addressURL.endsWith('/')) {
      console.warn(
        `Invalid URL address for import map specifier '${specifierKey}' - since the specifier ends in slash, so must the address`
      );
      normalized[normalizedSpecifierKey] = null;
      continue;
    }

    normalized[normalizedSpecifierKey] = addressURL;
  }

  return normalized;
}

// https://wicg.github.io/import-maps/#normalize-a-specifier-key
function normalizeSpecifierKey(key) {
  if (key === '') {
    console.warn(`Specifier keys in import maps may not be the empty string`);
    return null;
  }

  return parseURLLikeSpecifier(key, baseURL) || key;
}

// https://wicg.github.io/import-maps/#parse-a-url-like-import-specifier
function parseURLLikeSpecifier(specifier, baseURL) {
  const useBaseUrlAsParent =
    specifier.startsWith('/') ||
    specifier.startsWith('./') ||
    specifier.startsWith('../');

  try {
    return new URL(specifier, useBaseUrlAsParent ? baseURL : undefined).href;
  } catch {
    return null;
  }
}

// https://wicg.github.io/import-maps/#sort-and-normalize-scopes
function sortAndNormalizeScopes(map, baseURL) {
  let normalized = {};

  for (let scopePrefix in map) {
    const potentialSpecifierMap = map[scopePrefix];
    if (!isPlainObject(potentialSpecifierMap)) {
      throw TypeError(
        `The value of scope ${scopePrefix} must be a JSON object`
      );
    }

    let scopePrefixURL;
    try {
      scopePrefixURL = new URL(scopePrefix, baseURL).href;
    } catch {
      console.warn(
        `Scope prefix URL '${scopePrefix}' was not parseable in import map`
      );
      continue;
    }

    normalized[scopePrefixURL] = sortAndNormalizeSpecifierMap(
      potentialSpecifierMap,
      baseURL
    );
  }

  return normalized;
}

function isPlainObject(obj) {
  return obj === Object(obj) && !Array.isArray(obj);
}

// ---

let importMapPromise = getImportMapPromise();

export async function resolve(specifier, context, defaultResolve) {
  const { parentURL = null } = context;
  const importMap = await importMapPromise;
  const importMapUrl = resolveSpecifier(importMap, specifier, parentURL);

  return defaultResolve(importMapUrl ?? specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch module from ${url}`);
    }
    const source = await res.text();
    return {
      shortCircuit: true,
      format: 'module', 
      source,
    };
  }

  if (!url.startsWith('node:')) {
    context.format = 'module';
  }
  
  return defaultLoad(url, context, defaultLoad);
}

async function getImportMapPromise() {
  const relativePath = process.env.IMPORT_MAP_PATH || IMPORT_MAP_FILE_NAME;
  const importMapPath = path.resolve(process.cwd(), relativePath);

  let str;
  try {
    str = await fs.readFile(importMapPath);
  } catch (err) {
    return emptyMap();
  }

  let json;
  try {
    json = await JSON.parse(str);
  } catch (err) {
    throw Error(
      `Import map at ${importMapPath} contains invalid json: ${err.message}`
    );
  }

  return resolveAndComposeImportMap(json);
}

global.nodeLoader = global.nodeLoader || {};

global.nodeLoader.setImportMapPromise = function setImportMapPromise(promise) {
  importMapPromise = promise.then((map) => {
    return resolveAndComposeImportMap(map);
  });
};

function emptyMap() {
  return { imports: {}, scopes: {} };
}
