// libs/native-federation-node/src/lib/node/init-node-federation.ts
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as fs2 from 'node:fs/promises';
import * as path2 from 'node:path';

// libs/native-federation-runtime/src/lib/model/global-cache.ts
var nfNamespace = '__NATIVE_FEDERATION__';
var global2 = globalThis;
global2[nfNamespace] ??= {
  externals: /* @__PURE__ */ new Map(),
  remoteNamesToRemote: /* @__PURE__ */ new Map(),
  baseUrlToRemoteNames: /* @__PURE__ */ new Map(),
};
var globalCache = global2[nfNamespace];

// libs/native-federation-runtime/src/lib/model/externals.ts
var externals = globalCache.externals;
function getExternalKey(shared) {
  return `${shared.packageName}@${shared.version}`;
}
function getExternalUrl(shared) {
  const packageKey = getExternalKey(shared);
  return externals.get(packageKey);
}
function setExternalUrl(shared, url2) {
  const packageKey = getExternalKey(shared);
  externals.set(packageKey, url2);
}

// libs/native-federation-runtime/src/lib/model/import-map.ts
function mergeImportMaps(map1, map2) {
  return {
    imports: { ...map1.imports, ...map2.imports },
    scopes: { ...map1.scopes, ...map2.scopes },
  };
}

// libs/native-federation-runtime/src/lib/model/remotes.ts
var remoteNamesToRemote = globalCache.remoteNamesToRemote;
var baseUrlToRemoteNames = globalCache.baseUrlToRemoteNames;
function addRemote(remoteName, remote) {
  remoteNamesToRemote.set(remoteName, remote);
  baseUrlToRemoteNames.set(remote.baseUrl, remoteName);
}

// libs/native-federation-runtime/src/lib/utils/path-utils.ts
function getDirectory(url2) {
  const parts = url2.split('/');
  parts.pop();
  return parts.join('/');
}
function joinPaths(path1, path22) {
  while (path1.endsWith('/')) {
    path1 = path1.substring(0, path1.length - 1);
  }
  if (path22.startsWith('./')) {
    path22 = path22.substring(2, path22.length);
  }
  return `${path1}/${path22}`;
}

// libs/native-federation-runtime/src/lib/watch-federation-build.ts
function watchFederationBuildCompletion(endpoint) {
  const eventSource = new EventSource(endpoint);
  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === 'federation-rebuild-complete' /* COMPLETED */) {
      console.log('[Federation] Rebuild completed, reloading...');
      window.location.reload();
    }
  };
  eventSource.onerror = function (event) {
    console.warn('[Federation] SSE connection error:', event);
  };
}

// libs/native-federation-runtime/src/lib/init-federation.ts
async function processRemoteInfos(
  remotes,
  options = { throwIfRemoteNotFound: false },
) {
  const processRemoteInfoPromises = Object.keys(remotes).map(
    async (remoteName) => {
      try {
        let url2 = remotes[remoteName];
        if (options.cacheTag) {
          const addAppend = remotes[remoteName].includes('?') ? '&' : '?';
          url2 += `${addAppend}t=${options.cacheTag}`;
        }
        return await processRemoteInfo(url2, remoteName);
      } catch (e) {
        const error = `Error loading remote entry for ${remoteName} from file ${remotes[remoteName]}`;
        if (options.throwIfRemoteNotFound) {
          throw new Error(error);
        }
        console.error(error);
        return null;
      }
    },
  );
  const remoteImportMaps = await Promise.all(processRemoteInfoPromises);
  const importMap = remoteImportMaps.reduce(
    (acc, remoteImportMap) =>
      remoteImportMap ? mergeImportMaps(acc, remoteImportMap) : acc,
    { imports: {}, scopes: {} },
  );
  return importMap;
}
async function processRemoteInfo(federationInfoUrl, remoteName) {
  const baseUrl = getDirectory(federationInfoUrl);
  const remoteInfo = await loadFederationInfo(federationInfoUrl);
  if (!remoteName) {
    remoteName = remoteInfo.name;
  }
  if (remoteInfo.buildNotificationsEndpoint) {
    watchFederationBuildCompletion(
      baseUrl + remoteInfo.buildNotificationsEndpoint,
    );
  }
  const importMap = createRemoteImportMap(remoteInfo, remoteName, baseUrl);
  addRemote(remoteName, { ...remoteInfo, baseUrl });
  return importMap;
}
function createRemoteImportMap(remoteInfo, remoteName, baseUrl) {
  const imports = processExposed(remoteInfo, remoteName, baseUrl);
  const scopes = processRemoteImports(remoteInfo, baseUrl);
  return { imports, scopes };
}
async function loadFederationInfo(url2) {
  const info = await fetch(url2).then((r) => r.json());
  return info;
}
function processRemoteImports(remoteInfo, baseUrl) {
  const scopes = {};
  const scopedImports = {};
  for (const shared of remoteInfo.shared) {
    const outFileName =
      getExternalUrl(shared) ?? joinPaths(baseUrl, shared.outFileName);
    setExternalUrl(shared, outFileName);
    scopedImports[shared.packageName] = outFileName;
  }
  scopes[baseUrl + '/'] = scopedImports;
  return scopes;
}
function processExposed(remoteInfo, remoteName, baseUrl) {
  const imports = {};
  for (const exposed of remoteInfo.exposes) {
    const key = joinPaths(remoteName, exposed.key);
    const value = joinPaths(baseUrl, exposed.outFileName);
    imports[key] = value;
  }
  return imports;
}
async function processHostInfo(hostInfo, relBundlesPath = './') {
  const imports = hostInfo.shared.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.packageName]: relBundlesPath + cur.outFileName,
    }),
    {},
  );
  for (const shared of hostInfo.shared) {
    setExternalUrl(shared, relBundlesPath + shared.outFileName);
  }
  return { imports, scopes: {} };
}

// libs/native-federation-node/src/lib/utils/import-map-loader.js
import path from 'path';
import url from 'url';
import { promises as fs } from 'fs';
var IMPORT_MAP_FILE_NAME = 'node.importmap';
var baseURL = url.pathToFileURL(process.cwd()) + path.sep;
function resolveAndComposeImportMap(parsed) {
  if (!isPlainObject(parsed)) {
    throw Error(`Invalid import map - top level must be an object`);
  }
  let sortedAndNormalizedImports = {};
  if (Object.prototype.hasOwnProperty.call(parsed, 'imports')) {
    if (!isPlainObject(parsed.imports)) {
      throw Error(`Invalid import map - "imports" property must be an object`);
    }
    sortedAndNormalizedImports = sortAndNormalizeSpecifierMap(
      parsed.imports,
      baseURL,
    );
  }
  let sortedAndNormalizedScopes = {};
  if (Object.prototype.hasOwnProperty.call(parsed, 'scopes')) {
    if (!isPlainObject(parsed.scopes)) {
      throw Error(`Invalid import map - "scopes" property must be an object`);
    }
    sortedAndNormalizedScopes = sortAndNormalizeScopes(parsed.scopes, baseURL);
  }
  const invalidKeys = Object.keys(parsed).filter(
    (key) => key !== 'imports' && key !== 'scopes',
  );
  if (invalidKeys.length > 0) {
    console.warn(
      `Invalid top-level key${invalidKeys.length > 0 ? 's' : ''} in import map - ${invalidKeys.join(', ')}`,
    );
  }
  return {
    imports: sortedAndNormalizedImports,
    scopes: sortedAndNormalizedScopes,
  };
}
function sortAndNormalizeSpecifierMap(map, baseURL2) {
  const normalized = {};
  for (let specifierKey in map) {
    const value = map[specifierKey];
    const normalizedSpecifierKey = normalizeSpecifierKey(
      specifierKey,
      baseURL2,
    );
    if (normalizedSpecifierKey === null) {
      continue;
    }
    let addressURL = parseURLLikeSpecifier(value, baseURL2);
    if (addressURL === null) {
      console.warn(
        `Invalid URL address for import map specifier '${specifierKey}'`,
      );
      normalized[normalizedSpecifierKey] = null;
      continue;
    }
    if (specifierKey.endsWith('/') && !addressURL.endsWith('/')) {
      console.warn(
        `Invalid URL address for import map specifier '${specifierKey}' - since the specifier ends in slash, so must the address`,
      );
      normalized[normalizedSpecifierKey] = null;
      continue;
    }
    normalized[normalizedSpecifierKey] = addressURL;
  }
  return normalized;
}
function normalizeSpecifierKey(key) {
  if (key === '') {
    console.warn(`Specifier keys in import maps may not be the empty string`);
    return null;
  }
  return parseURLLikeSpecifier(key, baseURL) || key;
}
function parseURLLikeSpecifier(specifier, baseURL2) {
  const useBaseUrlAsParent =
    specifier.startsWith('/') ||
    specifier.startsWith('./') ||
    specifier.startsWith('../');
  try {
    return new URL(specifier, useBaseUrlAsParent ? baseURL2 : void 0).href;
  } catch {
    return null;
  }
}
function sortAndNormalizeScopes(map, baseURL2) {
  let normalized = {};
  for (let scopePrefix in map) {
    const potentialSpecifierMap = map[scopePrefix];
    if (!isPlainObject(potentialSpecifierMap)) {
      throw TypeError(
        `The value of scope ${scopePrefix} must be a JSON object`,
      );
    }
    let scopePrefixURL;
    try {
      scopePrefixURL = new URL(scopePrefix, baseURL2).href;
    } catch {
      console.warn(
        `Scope prefix URL '${scopePrefix}' was not parseable in import map`,
      );
      continue;
    }
    normalized[scopePrefixURL] = sortAndNormalizeSpecifierMap(
      potentialSpecifierMap,
      baseURL2,
    );
  }
  return normalized;
}
function isPlainObject(obj) {
  return obj === Object(obj) && !Array.isArray(obj);
}
var importMapPromise = getImportMapPromise();
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
      `Import map at ${importMapPath} contains invalid json: ${err.message}`,
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

// libs/native-federation-node/src/lib/utils/loader-as-data-url.js
var resolver =
  'aW1wb3J0IHBhdGggZnJvbSAncGF0aCc7CmltcG9ydCB1cmwgZnJvbSAndXJsJzsKaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7CgpleHBvcnQgY29uc3QgSU1QT1JUX01BUF9GSUxFX05BTUUgPSAnbm9kZS5pbXBvcnRtYXAnOwoKY29uc3QgYmFzZVVSTCA9IHVybC5wYXRoVG9GaWxlVVJMKHByb2Nlc3MuY3dkKCkpICsgcGF0aC5zZXA7CgovLyBodHRwczovL3dpY2cuZ2l0aHViLmlvL2ltcG9ydC1tYXBzLyNuZXctcmVzb2x2ZS1hbGdvcml0aG0KZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVTcGVjaWZpZXIoaW1wb3J0TWFwLCBzcGVjaWZpZXIsIHBhcmVudFVSTCkgewogIGxldCBjdXJyZW50QmFzZVVSTDsKICBpZiAocGFyZW50VVJMKSB7CiAgICBjb25zdCBsYXN0U2xhc2hJbmRleCA9IHBhcmVudFVSTC5sYXN0SW5kZXhPZihwYXRoLnNlcCk7CiAgICBjdXJyZW50QmFzZVVSTCA9IHBhcmVudFVSTC5zbGljZSgwLCBsYXN0U2xhc2hJbmRleCArIDEpOwogIH0gZWxzZSB7CiAgICBjdXJyZW50QmFzZVVSTCA9IGJhc2VVUkw7CiAgfQogIGNvbnN0IG5vcm1hbGl6ZWRTcGVjaWZpZXIgPQogICAgcGFyc2VVUkxMaWtlU3BlY2lmaWVyKHNwZWNpZmllciwgY3VycmVudEJhc2VVUkwpIHx8IHNwZWNpZmllcjsKICBmb3IgKGxldCBzY29wZVByZWZpeCBpbiBpbXBvcnRNYXAuc2NvcGVzKSB7CiAgICBpZiAoCiAgICAgIHNjb3BlUHJlZml4ID09PSBjdXJyZW50QmFzZVVSTCB8fAogICAgICAoc2NvcGVQcmVmaXguZW5kc1dpdGgoJy8nKSAmJiBjdXJyZW50QmFzZVVSTC5zdGFydHNXaXRoKHNjb3BlUHJlZml4KSkKICAgICkgewogICAgICBjb25zdCBzY29wZUltcG9ydHNNYXRjaCA9IHJlc29sdmVJbXBvcnRzTWF0Y2goCiAgICAgICAgbm9ybWFsaXplZFNwZWNpZmllciwKICAgICAgICBpbXBvcnRNYXAuc2NvcGVzW3Njb3BlUHJlZml4XSwKICAgICAgKTsKICAgICAgaWYgKHNjb3BlSW1wb3J0c01hdGNoKSB7CiAgICAgICAgcmV0dXJuIHNjb3BlSW1wb3J0c01hdGNoOwogICAgICB9CiAgICB9IGVsc2UgewogICAgICBjb25zdCB0b3BMZXZlbEltcG9ydHNNYXRjaCA9IHJlc29sdmVJbXBvcnRzTWF0Y2goCiAgICAgICAgbm9ybWFsaXplZFNwZWNpZmllciwKICAgICAgICBpbXBvcnRNYXAuaW1wb3J0cywKICAgICAgKTsKICAgICAgaWYgKHRvcExldmVsSW1wb3J0c01hdGNoKSB7CiAgICAgICAgcmV0dXJuIHRvcExldmVsSW1wb3J0c01hdGNoOwogICAgICB9CiAgICB9CiAgfQoKICByZXR1cm4gcmVzb2x2ZUltcG9ydHNNYXRjaChub3JtYWxpemVkU3BlY2lmaWVyLCBpbXBvcnRNYXAuaW1wb3J0cyk7Cn0KCi8vIGh0dHBzOi8vd2ljZy5naXRodWIuaW8vaW1wb3J0LW1hcHMvI3Jlc29sdmUtYW4taW1wb3J0cy1tYXRjaApmdW5jdGlvbiByZXNvbHZlSW1wb3J0c01hdGNoKG5vcm1hbGl6ZWRTcGVjaWZpZXIsIHNwZWNpZmllck1hcCkgewogIGZvciAobGV0IHNwZWNpZmllcktleSBpbiBzcGVjaWZpZXJNYXApIHsKICAgIGNvbnN0IHJlc29sdXRpb25SZXN1bHQgPSBzcGVjaWZpZXJNYXBbc3BlY2lmaWVyS2V5XTsKCiAgICBpZiAoc3BlY2lmaWVyS2V5ID09PSBub3JtYWxpemVkU3BlY2lmaWVyKSB7CiAgICAgIGlmIChyZXNvbHV0aW9uUmVzdWx0ID09PSBudWxsKSB7CiAgICAgICAgdGhyb3cgVHlwZUVycm9yKAogICAgICAgICAgYFRoZSBpbXBvcnQgbWFwIHJlc29sdXRpb24gb2YgJHtzcGVjaWZpZXJLZXl9IGZhaWxlZCBkdWUgdG8gYSBudWxsIGVudHJ5YCwKICAgICAgICApOwogICAgICB9CiAgICAgIHJldHVybiByZXNvbHV0aW9uUmVzdWx0OwogICAgfSBlbHNlIGlmICgKICAgICAgc3BlY2lmaWVyS2V5LmVuZHNXaXRoKCcvJykgJiYKICAgICAgbm9ybWFsaXplZFNwZWNpZmllci5zdGFydHNXaXRoKHNwZWNpZmllcktleSkKICAgICkgewogICAgICBpZiAocmVzb2x1dGlvblJlc3VsdCA9PT0gbnVsbCkgewogICAgICAgIHRocm93IFR5cGVFcnJvcigKICAgICAgICAgIGBUaGUgaW1wb3J0IG1hcCByZXNvbHV0aW9uIG9mICR7c3BlY2lmaWVyS2V5fSBmYWlsZWQgZHVlIHRvIGEgbnVsbCBlbnRyeWAsCiAgICAgICAgKTsKICAgICAgfQogICAgICBjb25zdCBhZnRlclByZWZpeCA9IG5vcm1hbGl6ZWRTcGVjaWZpZXIuc2xpY2Uoc3BlY2lmaWVyS2V5Lmxlbmd0aCk7CiAgICAgIHRyeSB7CiAgICAgICAgcmV0dXJuIG5ldyBVUkwoYWZ0ZXJQcmVmaXgsIHJlc29sdXRpb25SZXN1bHQpLmhyZWY7CiAgICAgIH0gY2F0Y2ggewogICAgICAgIHRocm93IFR5cGVFcnJvcigKICAgICAgICAgIGBUaGUgaW1wb3J0IG1hcCByZXNvbHV0aW9uIG9mICR7c3BlY2lmaWVyS2V5fSBmYWlsZWQgZHVlIHRvIFVSTCBwYXJzZSBmYWlsdXJlYCwKICAgICAgICApOwogICAgICB9CiAgICB9CiAgfQoKICByZXR1cm4gbnVsbDsKfQoKLy8gaHR0cHM6Ly93aWNnLmdpdGh1Yi5pby9pbXBvcnQtbWFwcy8jcGFyc2luZwpleHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUFuZENvbXBvc2VJbXBvcnRNYXAocGFyc2VkKSB7CiAgLy8gU3RlcCAyCiAgaWYgKCFpc1BsYWluT2JqZWN0KHBhcnNlZCkpIHsKICAgIHRocm93IEVycm9yKGBJbnZhbGlkIGltcG9ydCBtYXAgLSB0b3AgbGV2ZWwgbXVzdCBiZSBhbiBvYmplY3RgKTsKICB9CgogIC8vIFN0ZXAgMwogIGxldCBzb3J0ZWRBbmROb3JtYWxpemVkSW1wb3J0cyA9IHt9OwoKICAvLyBTdGVwIDQKICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHBhcnNlZCwgJ2ltcG9ydHMnKSkgewogICAgLy8gU3RlcCA0LjEKICAgIGlmICghaXNQbGFpbk9iamVjdChwYXJzZWQuaW1wb3J0cykpIHsKICAgICAgdGhyb3cgRXJyb3IoYEludmFsaWQgaW1wb3J0IG1hcCAtICJpbXBvcnRzIiBwcm9wZXJ0eSBtdXN0IGJlIGFuIG9iamVjdGApOwogICAgfQoKICAgIC8vIFN0ZXAgNC4yCiAgICBzb3J0ZWRBbmROb3JtYWxpemVkSW1wb3J0cyA9IHNvcnRBbmROb3JtYWxpemVTcGVjaWZpZXJNYXAoCiAgICAgIHBhcnNlZC5pbXBvcnRzLAogICAgICBiYXNlVVJMLAogICAgKTsKICB9CgogIC8vIFN0ZXAgNQogIGxldCBzb3J0ZWRBbmROb3JtYWxpemVkU2NvcGVzID0ge307CgogIC8vIFN0ZXAgNgogIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocGFyc2VkLCAnc2NvcGVzJykpIHsKICAgIC8vIFN0ZXAgNi4xCiAgICBpZiAoIWlzUGxhaW5PYmplY3QocGFyc2VkLnNjb3BlcykpIHsKICAgICAgdGhyb3cgRXJyb3IoYEludmFsaWQgaW1wb3J0IG1hcCAtICJzY29wZXMiIHByb3BlcnR5IG11c3QgYmUgYW4gb2JqZWN0YCk7CiAgICB9CgogICAgLy8gU3RlcCA2LjIKICAgIHNvcnRlZEFuZE5vcm1hbGl6ZWRTY29wZXMgPSBzb3J0QW5kTm9ybWFsaXplU2NvcGVzKHBhcnNlZC5zY29wZXMsIGJhc2VVUkwpOwogIH0KCiAgLy8gU3RlcCA3CiAgY29uc3QgaW52YWxpZEtleXMgPSBPYmplY3Qua2V5cyhwYXJzZWQpLmZpbHRlcigKICAgIChrZXkpID0+IGtleSAhPT0gJ2ltcG9ydHMnICYmIGtleSAhPT0gJ3Njb3BlcycsCiAgKTsKICBpZiAoaW52YWxpZEtleXMubGVuZ3RoID4gMCkgewogICAgY29uc29sZS53YXJuKAogICAgICBgSW52YWxpZCB0b3AtbGV2ZWwga2V5JHsKICAgICAgICBpbnZhbGlkS2V5cy5sZW5ndGggPiAwID8gJ3MnIDogJycKICAgICAgfSBpbiBpbXBvcnQgbWFwIC0gJHtpbnZhbGlkS2V5cy5qb2luKCcsICcpfWAsCiAgICApOwogIH0KCiAgLy8gU3RlcCA4CiAgcmV0dXJuIHsKICAgIGltcG9ydHM6IHNvcnRlZEFuZE5vcm1hbGl6ZWRJbXBvcnRzLAogICAgc2NvcGVzOiBzb3J0ZWRBbmROb3JtYWxpemVkU2NvcGVzLAogIH07Cn0KCi8vIGh0dHBzOi8vd2ljZy5naXRodWIuaW8vaW1wb3J0LW1hcHMvI3NvcnQtYW5kLW5vcm1hbGl6ZS1hLXNwZWNpZmllci1tYXAKZnVuY3Rpb24gc29ydEFuZE5vcm1hbGl6ZVNwZWNpZmllck1hcChtYXAsIGJhc2VVUkwpIHsKICBjb25zdCBub3JtYWxpemVkID0ge307CgogIGZvciAobGV0IHNwZWNpZmllcktleSBpbiBtYXApIHsKICAgIGNvbnN0IHZhbHVlID0gbWFwW3NwZWNpZmllcktleV07CgogICAgY29uc3Qgbm9ybWFsaXplZFNwZWNpZmllcktleSA9IG5vcm1hbGl6ZVNwZWNpZmllcktleShzcGVjaWZpZXJLZXksIGJhc2VVUkwpOwogICAgaWYgKG5vcm1hbGl6ZWRTcGVjaWZpZXJLZXkgPT09IG51bGwpIHsKICAgICAgY29udGludWU7CiAgICB9CgogICAgbGV0IGFkZHJlc3NVUkwgPSBwYXJzZVVSTExpa2VTcGVjaWZpZXIodmFsdWUsIGJhc2VVUkwpOwogICAgaWYgKGFkZHJlc3NVUkwgPT09IG51bGwpIHsKICAgICAgY29uc29sZS53YXJuKAogICAgICAgIGBJbnZhbGlkIFVSTCBhZGRyZXNzIGZvciBpbXBvcnQgbWFwIHNwZWNpZmllciAnJHtzcGVjaWZpZXJLZXl9J2AsCiAgICAgICk7CiAgICAgIG5vcm1hbGl6ZWRbbm9ybWFsaXplZFNwZWNpZmllcktleV0gPSBudWxsOwogICAgICBjb250aW51ZTsKICAgIH0KCiAgICBpZiAoc3BlY2lmaWVyS2V5LmVuZHNXaXRoKCcvJykgJiYgIWFkZHJlc3NVUkwuZW5kc1dpdGgoJy8nKSkgewogICAgICBjb25zb2xlLndhcm4oCiAgICAgICAgYEludmFsaWQgVVJMIGFkZHJlc3MgZm9yIGltcG9ydCBtYXAgc3BlY2lmaWVyICcke3NwZWNpZmllcktleX0nIC0gc2luY2UgdGhlIHNwZWNpZmllciBlbmRzIGluIHNsYXNoLCBzbyBtdXN0IHRoZSBhZGRyZXNzYCwKICAgICAgKTsKICAgICAgbm9ybWFsaXplZFtub3JtYWxpemVkU3BlY2lmaWVyS2V5XSA9IG51bGw7CiAgICAgIGNvbnRpbnVlOwogICAgfQoKICAgIG5vcm1hbGl6ZWRbbm9ybWFsaXplZFNwZWNpZmllcktleV0gPSBhZGRyZXNzVVJMOwogIH0KCiAgcmV0dXJuIG5vcm1hbGl6ZWQ7Cn0KCi8vIGh0dHBzOi8vd2ljZy5naXRodWIuaW8vaW1wb3J0LW1hcHMvI25vcm1hbGl6ZS1hLXNwZWNpZmllci1rZXkKZnVuY3Rpb24gbm9ybWFsaXplU3BlY2lmaWVyS2V5KGtleSkgewogIGlmIChrZXkgPT09ICcnKSB7CiAgICBjb25zb2xlLndhcm4oYFNwZWNpZmllciBrZXlzIGluIGltcG9ydCBtYXBzIG1heSBub3QgYmUgdGhlIGVtcHR5IHN0cmluZ2ApOwogICAgcmV0dXJuIG51bGw7CiAgfQoKICByZXR1cm4gcGFyc2VVUkxMaWtlU3BlY2lmaWVyKGtleSwgYmFzZVVSTCkgfHwga2V5Owp9CgovLyBodHRwczovL3dpY2cuZ2l0aHViLmlvL2ltcG9ydC1tYXBzLyNwYXJzZS1hLXVybC1saWtlLWltcG9ydC1zcGVjaWZpZXIKZnVuY3Rpb24gcGFyc2VVUkxMaWtlU3BlY2lmaWVyKHNwZWNpZmllciwgYmFzZVVSTCkgewogIGNvbnN0IHVzZUJhc2VVcmxBc1BhcmVudCA9CiAgICBzcGVjaWZpZXIuc3RhcnRzV2l0aCgnLycpIHx8CiAgICBzcGVjaWZpZXIuc3RhcnRzV2l0aCgnLi8nKSB8fAogICAgc3BlY2lmaWVyLnN0YXJ0c1dpdGgoJy4uLycpOwoKICB0cnkgewogICAgcmV0dXJuIG5ldyBVUkwoc3BlY2lmaWVyLCB1c2VCYXNlVXJsQXNQYXJlbnQgPyBiYXNlVVJMIDogdW5kZWZpbmVkKS5ocmVmOwogIH0gY2F0Y2ggewogICAgcmV0dXJuIG51bGw7CiAgfQp9CgovLyBodHRwczovL3dpY2cuZ2l0aHViLmlvL2ltcG9ydC1tYXBzLyNzb3J0LWFuZC1ub3JtYWxpemUtc2NvcGVzCmZ1bmN0aW9uIHNvcnRBbmROb3JtYWxpemVTY29wZXMobWFwLCBiYXNlVVJMKSB7CiAgbGV0IG5vcm1hbGl6ZWQgPSB7fTsKCiAgZm9yIChsZXQgc2NvcGVQcmVmaXggaW4gbWFwKSB7CiAgICBjb25zdCBwb3RlbnRpYWxTcGVjaWZpZXJNYXAgPSBtYXBbc2NvcGVQcmVmaXhdOwogICAgaWYgKCFpc1BsYWluT2JqZWN0KHBvdGVudGlhbFNwZWNpZmllck1hcCkpIHsKICAgICAgdGhyb3cgVHlwZUVycm9yKAogICAgICAgIGBUaGUgdmFsdWUgb2Ygc2NvcGUgJHtzY29wZVByZWZpeH0gbXVzdCBiZSBhIEpTT04gb2JqZWN0YCwKICAgICAgKTsKICAgIH0KCiAgICBsZXQgc2NvcGVQcmVmaXhVUkw7CiAgICB0cnkgewogICAgICBzY29wZVByZWZpeFVSTCA9IG5ldyBVUkwoc2NvcGVQcmVmaXgsIGJhc2VVUkwpLmhyZWY7CiAgICB9IGNhdGNoIHsKICAgICAgY29uc29sZS53YXJuKAogICAgICAgIGBTY29wZSBwcmVmaXggVVJMICcke3Njb3BlUHJlZml4fScgd2FzIG5vdCBwYXJzZWFibGUgaW4gaW1wb3J0IG1hcGAsCiAgICAgICk7CiAgICAgIGNvbnRpbnVlOwogICAgfQoKICAgIG5vcm1hbGl6ZWRbc2NvcGVQcmVmaXhVUkxdID0gc29ydEFuZE5vcm1hbGl6ZVNwZWNpZmllck1hcCgKICAgICAgcG90ZW50aWFsU3BlY2lmaWVyTWFwLAogICAgICBiYXNlVVJMLAogICAgKTsKICB9CgogIHJldHVybiBub3JtYWxpemVkOwp9CgpmdW5jdGlvbiBpc1BsYWluT2JqZWN0KG9iaikgewogIHJldHVybiBvYmogPT09IE9iamVjdChvYmopICYmICFBcnJheS5pc0FycmF5KG9iaik7Cn0KCi8vIC0tLQoKbGV0IGltcG9ydE1hcFByb21pc2UgPSBnZXRJbXBvcnRNYXBQcm9taXNlKCk7CgpleHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZShzcGVjaWZpZXIsIGNvbnRleHQsIGRlZmF1bHRSZXNvbHZlKSB7CiAgY29uc3QgeyBwYXJlbnRVUkwgPSBudWxsIH0gPSBjb250ZXh0OwogIGNvbnN0IGltcG9ydE1hcCA9IGF3YWl0IGltcG9ydE1hcFByb21pc2U7CiAgY29uc3QgaW1wb3J0TWFwVXJsID0gcmVzb2x2ZVNwZWNpZmllcihpbXBvcnRNYXAsIHNwZWNpZmllciwgcGFyZW50VVJMKTsKCiAgcmV0dXJuIGRlZmF1bHRSZXNvbHZlKGltcG9ydE1hcFVybCA/PyBzcGVjaWZpZXIsIGNvbnRleHQsIGRlZmF1bHRSZXNvbHZlKTsKfQoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWQodXJsLCBjb250ZXh0LCBkZWZhdWx0TG9hZCkgewogIGlmICh1cmwuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IHVybC5zdGFydHNXaXRoKCdodHRwczovLycpKSB7CiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwpOwogICAgaWYgKCFyZXMub2spIHsKICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmV0Y2ggbW9kdWxlIGZyb20gJHt1cmx9YCk7CiAgICB9CiAgICBjb25zdCBzb3VyY2UgPSBhd2FpdCByZXMudGV4dCgpOwogICAgcmV0dXJuIHsKICAgICAgc2hvcnRDaXJjdWl0OiB0cnVlLAogICAgICBmb3JtYXQ6ICdtb2R1bGUnLAogICAgICBzb3VyY2UsCiAgICB9OwogIH0KCiAgaWYgKCF1cmwuc3RhcnRzV2l0aCgnbm9kZTonKSkgewogICAgY29udGV4dC5mb3JtYXQgPSAnbW9kdWxlJzsKICB9CgogIHJldHVybiBkZWZhdWx0TG9hZCh1cmwsIGNvbnRleHQsIGRlZmF1bHRMb2FkKTsKfQoKYXN5bmMgZnVuY3Rpb24gZ2V0SW1wb3J0TWFwUHJvbWlzZSgpIHsKICBjb25zdCByZWxhdGl2ZVBhdGggPSBwcm9jZXNzLmVudi5JTVBPUlRfTUFQX1BBVEggfHwgSU1QT1JUX01BUF9GSUxFX05BTUU7CiAgY29uc3QgaW1wb3J0TWFwUGF0aCA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCByZWxhdGl2ZVBhdGgpOwoKICBsZXQgc3RyOwogIHRyeSB7CiAgICBzdHIgPSBhd2FpdCBmcy5yZWFkRmlsZShpbXBvcnRNYXBQYXRoKTsKICB9IGNhdGNoIChlcnIpIHsKICAgIHJldHVybiBlbXB0eU1hcCgpOwogIH0KCiAgbGV0IGpzb247CiAgdHJ5IHsKICAgIGpzb24gPSBhd2FpdCBKU09OLnBhcnNlKHN0cik7CiAgfSBjYXRjaCAoZXJyKSB7CiAgICB0aHJvdyBFcnJvcigKICAgICAgYEltcG9ydCBtYXAgYXQgJHtpbXBvcnRNYXBQYXRofSBjb250YWlucyBpbnZhbGlkIGpzb246ICR7ZXJyLm1lc3NhZ2V9YCwKICAgICk7CiAgfQoKICByZXR1cm4gcmVzb2x2ZUFuZENvbXBvc2VJbXBvcnRNYXAoanNvbik7Cn0KCmdsb2JhbC5ub2RlTG9hZGVyID0gZ2xvYmFsLm5vZGVMb2FkZXIgfHwge307CgpnbG9iYWwubm9kZUxvYWRlci5zZXRJbXBvcnRNYXBQcm9taXNlID0gZnVuY3Rpb24gc2V0SW1wb3J0TWFwUHJvbWlzZShwcm9taXNlKSB7CiAgaW1wb3J0TWFwUHJvbWlzZSA9IHByb21pc2UudGhlbigobWFwKSA9PiB7CiAgICByZXR1cm4gcmVzb2x2ZUFuZENvbXBvc2VJbXBvcnRNYXAobWFwKTsKICB9KTsKfTsKCmZ1bmN0aW9uIGVtcHR5TWFwKCkgewogIHJldHVybiB7IGltcG9ydHM6IHt9LCBzY29wZXM6IHt9IH07Cn0K';

// libs/native-federation-node/src/lib/node/init-node-federation.ts
var defaultOptions = {
  remotesOrManifestUrl: {},
  relBundlePath: '../browser',
  throwIfRemoteNotFound: false,
};
async function initNodeFederation(options) {
  const mergedOptions = { ...defaultOptions, ...options };
  const importMap = await createNodeImportMap(mergedOptions);
  await writeImportMap(importMap);
  await writeResolver();
  register(pathToFileURL('./federation-resolver.mjs').href);
}
async function createNodeImportMap(options) {
  const { remotesOrManifestUrl, relBundlePath } = options;
  const remotes =
    typeof remotesOrManifestUrl === 'object'
      ? remotesOrManifestUrl
      : await loadFsManifest(remotesOrManifestUrl);
  const hostInfo = await loadFsFederationInfo(relBundlePath);
  const hostImportMap = await processHostInfo(hostInfo, './' + relBundlePath);
  const remotesImportMap = await processRemoteInfos(remotes, {
    throwIfRemoteNotFound: options.throwIfRemoteNotFound,
    cacheTag: options.cacheTag,
  });
  const importMap = mergeImportMaps(hostImportMap, remotesImportMap);
  return importMap;
}
async function loadFsManifest(manifestUrl) {
  const content = await fs2.readFile(manifestUrl, 'utf-8');
  const manifest = JSON.parse(content);
  return manifest;
}
async function loadFsFederationInfo(relBundlePath) {
  const manifestPath = path2.join(relBundlePath, 'remoteEntry.json');
  const content = await fs2.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(content);
  return manifest;
}
async function writeImportMap(map) {
  await fs2.writeFile(
    IMPORT_MAP_FILE_NAME,
    JSON.stringify(map, null, 2),
    'utf-8',
  );
}
async function writeResolver() {
  const buffer = Buffer.from(resolver, 'base64');
  await fs2.writeFile('federation-resolver.mjs', buffer, 'utf-8');
}

// libs/native-federation-node/src/lib/utils/fstart-args-parser.ts
import * as fs3 from 'node:fs';
var defaultArgs = {
  entry: './server.mjs',
  remotesOrManifestUrl: '../browser/federation.manifest.json',
  relBundlePath: '../browser/',
};
function parseFStartArgs() {
  const args2 = {
    entry: '',
    remotesOrManifestUrl: '',
    relBundlePath: '',
  };
  let key = '';
  for (let i = 2; i < process.argv.length; i++) {
    const cand = process.argv[i];
    if (cand.startsWith('--')) {
      const candKey = cand.substring(2);
      if (defaultArgs[candKey]) {
        key = candKey;
      } else {
        console.error(`switch ${cand} not supported!`);
        exitWithUsage(defaultArgs);
      }
    } else if (key) {
      args2[key] = cand;
      key = '';
    } else {
      console.error(`unreladed value ${cand}!`);
      exitWithUsage(defaultArgs);
    }
  }
  applyDefaultArgs(args2);
  return args2;
}
function applyDefaultArgs(args2) {
  if (args2.relBundlePath && !args2.remotesOrManifestUrl) {
    const cand = defaultArgs.relBundlePath + 'federation.manifest.json';
    if (fs3.existsSync(cand)) {
      args2.remotesOrManifestUrl = cand;
    }
  }
  args2.entry = args2.entry || defaultArgs.entry;
  args2.relBundlePath = args2.relBundlePath || defaultArgs.relBundlePath;
  args2.remotesOrManifestUrl =
    args2.remotesOrManifestUrl || defaultArgs.remotesOrManifestUrl;
  if (!fs3.existsSync(args2.remotesOrManifestUrl)) {
    args2.remotesOrManifestUrl = void 0;
  }
}
function exitWithUsage(defaultArgs2) {
  let args2 = '';
  for (const key in defaultArgs2) {
    args2 += `[--${key} ${defaultArgs2[key]}] `;
  }
  console.log('usage: nfstart ' + args2);
  process.exit(1);
}

// libs/native-federation-node/src/lib/utils/fstart.ts
var args = parseFStartArgs();
(async () => {
  await initNodeFederation({
    ...(args.remotesOrManifestUrl
      ? { remotesOrManifestUrl: args.remotesOrManifestUrl }
      : {}),
    relBundlePath: args.relBundlePath,
  });
  await import(args.entry);
})();
