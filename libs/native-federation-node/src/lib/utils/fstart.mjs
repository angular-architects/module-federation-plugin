// libs/native-federation-node/src/lib/node/init-node-federation.ts
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import * as fs2 from "node:fs/promises";
import * as path2 from "node:path";

// libs/native-federation-runtime/src/lib/model/global-cache.ts
var nfNamespace = "__NATIVE_FEDERATION__";
var global2 = globalThis;
global2[nfNamespace] ??= {
  externals: /* @__PURE__ */ new Map(),
  remoteNamesToRemote: /* @__PURE__ */ new Map(),
  baseUrlToRemoteNames: /* @__PURE__ */ new Map()
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
    scopes: { ...map1.scopes, ...map2.scopes }
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
  const parts = url2.split("/");
  parts.pop();
  return parts.join("/");
}
function joinPaths(path1, path22) {
  while (path1.endsWith("/")) {
    path1 = path1.substring(0, path1.length - 1);
  }
  if (path22.startsWith("./")) {
    path22 = path22.substring(2, path22.length);
  }
  return `${path1}/${path22}`;
}

// libs/native-federation-runtime/src/lib/watch-federation-build.ts
function watchFederationBuildCompletion(endpoint) {
  const eventSource = new EventSource(endpoint);
  eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.type === "federation-rebuild-complete" /* COMPLETED */) {
      console.log("[Federation] Rebuild completed, reloading...");
      window.location.reload();
    }
  };
  eventSource.onerror = function(event) {
    console.warn("[Federation] SSE connection error:", event);
  };
}

// libs/native-federation-runtime/src/lib/init-federation.ts
async function processRemoteInfos(remotes, options = { throwIfRemoteNotFound: false }) {
  const processRemoteInfoPromises = Object.keys(remotes).map(
    async (remoteName) => {
      try {
        let url2 = remotes[remoteName];
        if (options.cacheTag) {
          const addAppend = remotes[remoteName].includes("?") ? "&" : "?";
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
    }
  );
  const remoteImportMaps = await Promise.all(processRemoteInfoPromises);
  const importMap = remoteImportMaps.reduce(
    (acc, remoteImportMap) => remoteImportMap ? mergeImportMaps(acc, remoteImportMap) : acc,
    { imports: {}, scopes: {} }
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
      baseUrl + remoteInfo.buildNotificationsEndpoint
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
    const outFileName = getExternalUrl(shared) ?? joinPaths(baseUrl, shared.outFileName);
    setExternalUrl(shared, outFileName);
    scopedImports[shared.packageName] = outFileName;
  }
  scopes[baseUrl + "/"] = scopedImports;
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
async function processHostInfo(hostInfo, relBundlesPath = "./") {
  const imports = hostInfo.shared.reduce(
    (acc, cur) => ({
      ...acc,
      [cur.packageName]: relBundlesPath + cur.outFileName
    }),
    {}
  );
  for (const shared of hostInfo.shared) {
    setExternalUrl(shared, relBundlesPath + shared.outFileName);
  }
  return { imports, scopes: {} };
}

// libs/native-federation-node/src/lib/utils/import-map-loader.js
import path from "path";
import url from "url";
import { promises as fs } from "fs";
var IMPORT_MAP_FILE_NAME = "node.importmap";
var baseURL = url.pathToFileURL(process.cwd()) + path.sep;
function resolveAndComposeImportMap(parsed) {
  if (!isPlainObject(parsed)) {
    throw Error(`Invalid import map - top level must be an object`);
  }
  let sortedAndNormalizedImports = {};
  if (parsed.hasOwnProperty("imports")) {
    if (!isPlainObject(parsed.imports)) {
      throw Error(`Invalid import map - "imports" property must be an object`);
    }
    sortedAndNormalizedImports = sortAndNormalizeSpecifierMap(
      parsed.imports,
      baseURL
    );
  }
  let sortedAndNormalizedScopes = {};
  if (parsed.hasOwnProperty("scopes")) {
    if (!isPlainObject(parsed.scopes)) {
      throw Error(`Invalid import map - "scopes" property must be an object`);
    }
    sortedAndNormalizedScopes = sortAndNormalizeScopes(parsed.scopes, baseURL);
  }
  const invalidKeys = Object.keys(parsed).filter(
    (key) => key !== "imports" && key !== "scopes"
  );
  if (invalidKeys.length > 0) {
    console.warn(
      `Invalid top-level key${invalidKeys.length > 0 ? "s" : ""} in import map - ${invalidKeys.join(", ")}`
    );
  }
  return {
    imports: sortedAndNormalizedImports,
    scopes: sortedAndNormalizedScopes
  };
}
function sortAndNormalizeSpecifierMap(map, baseURL2) {
  const normalized = {};
  for (let specifierKey in map) {
    const value = map[specifierKey];
    const normalizedSpecifierKey = normalizeSpecifierKey(specifierKey, baseURL2);
    if (normalizedSpecifierKey === null) {
      continue;
    }
    let addressURL = parseURLLikeSpecifier(value, baseURL2);
    if (addressURL === null) {
      console.warn(
        `Invalid URL address for import map specifier '${specifierKey}'`
      );
      normalized[normalizedSpecifierKey] = null;
      continue;
    }
    if (specifierKey.endsWith("/") && !addressURL.endsWith("/")) {
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
function normalizeSpecifierKey(key) {
  if (key === "") {
    console.warn(`Specifier keys in import maps may not be the empty string`);
    return null;
  }
  return parseURLLikeSpecifier(key, baseURL) || key;
}
function parseURLLikeSpecifier(specifier, baseURL2) {
  const useBaseUrlAsParent = specifier.startsWith("/") || specifier.startsWith("./") || specifier.startsWith("../");
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
        `The value of scope ${scopePrefix} must be a JSON object`
      );
    }
    let scopePrefixURL;
    try {
      scopePrefixURL = new URL(scopePrefix, baseURL2).href;
    } catch {
      console.warn(
        `Scope prefix URL '${scopePrefix}' was not parseable in import map`
      );
      continue;
    }
    normalized[scopePrefixURL] = sortAndNormalizeSpecifierMap(
      potentialSpecifierMap,
      baseURL2
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

// libs/native-federation-node/src/lib/utils/loader-as-data-url.js
var resolver = "aW1wb3J0IHBhdGggZnJvbSAncGF0aCc7CmltcG9ydCB1cmwgZnJvbSAndXJsJzsKaW1wb3J0IHsgcHJvbWlzZXMgYXMgZnMgfSBmcm9tICdmcyc7CgpleHBvcnQgY29uc3QgSU1QT1JUX01BUF9GSUxFX05BTUUgPSAnbm9kZS5pbXBvcnRtYXAnOwoKY29uc3QgYmFzZVVSTCA9IHVybC5wYXRoVG9GaWxlVVJMKHByb2Nlc3MuY3dkKCkpICsgcGF0aC5zZXA7CgovLyBodHRwczovL3dpY2cuZ2l0aHViLmlvL2ltcG9ydC1tYXBzLyNuZXctcmVzb2x2ZS1hbGdvcml0aG0KZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVTcGVjaWZpZXIoaW1wb3J0TWFwLCBzcGVjaWZpZXIsIHBhcmVudFVSTCkgewogIGxldCBjdXJyZW50QmFzZVVSTDsKICBpZiAocGFyZW50VVJMKSB7CiAgICBjb25zdCBsYXN0U2xhc2hJbmRleCA9IHBhcmVudFVSTC5sYXN0SW5kZXhPZihwYXRoLnNlcCk7CiAgICBjdXJyZW50QmFzZVVSTCA9IHBhcmVudFVSTC5zbGljZSgwLCBsYXN0U2xhc2hJbmRleCArIDEpOwogIH0gZWxzZSB7CiAgICBjdXJyZW50QmFzZVVSTCA9IGJhc2VVUkw7CiAgfQogIGNvbnN0IG5vcm1hbGl6ZWRTcGVjaWZpZXIgPQogICAgcGFyc2VVUkxMaWtlU3BlY2lmaWVyKHNwZWNpZmllciwgY3VycmVudEJhc2VVUkwpIHx8IHNwZWNpZmllcjsKICBmb3IgKGxldCBzY29wZVByZWZpeCBpbiBpbXBvcnRNYXAuc2NvcGVzKSB7CiAgICBpZiAoCiAgICAgIHNjb3BlUHJlZml4ID09PSBjdXJyZW50QmFzZVVSTCB8fAogICAgICAoc2NvcGVQcmVmaXguZW5kc1dpdGgoJy8nKSAmJiBjdXJyZW50QmFzZVVSTC5zdGFydHNXaXRoKHNjb3BlUHJlZml4KSkKICAgICkgewogICAgICBjb25zdCBzY29wZUltcG9ydHNNYXRjaCA9IHJlc29sdmVJbXBvcnRzTWF0Y2goCiAgICAgICAgbm9ybWFsaXplZFNwZWNpZmllciwKICAgICAgICBpbXBvcnRNYXAuc2NvcGVzW3Njb3BlUHJlZml4XQogICAgICApOwogICAgICBpZiAoc2NvcGVJbXBvcnRzTWF0Y2gpIHsKICAgICAgICByZXR1cm4gc2NvcGVJbXBvcnRzTWF0Y2g7CiAgICAgIH0KICAgIH0gZWxzZSB7CiAgICAgIGNvbnN0IHRvcExldmVsSW1wb3J0c01hdGNoID0gcmVzb2x2ZUltcG9ydHNNYXRjaCgKICAgICAgICBub3JtYWxpemVkU3BlY2lmaWVyLAogICAgICAgIGltcG9ydE1hcC5pbXBvcnRzCiAgICAgICk7CiAgICAgIGlmICh0b3BMZXZlbEltcG9ydHNNYXRjaCkgewogICAgICAgIHJldHVybiB0b3BMZXZlbEltcG9ydHNNYXRjaDsKICAgICAgfQogICAgfQogIH0KCiAgcmV0dXJuIHJlc29sdmVJbXBvcnRzTWF0Y2gobm9ybWFsaXplZFNwZWNpZmllciwgaW1wb3J0TWFwLmltcG9ydHMpOwp9CgovLyBodHRwczovL3dpY2cuZ2l0aHViLmlvL2ltcG9ydC1tYXBzLyNyZXNvbHZlLWFuLWltcG9ydHMtbWF0Y2gKZnVuY3Rpb24gcmVzb2x2ZUltcG9ydHNNYXRjaChub3JtYWxpemVkU3BlY2lmaWVyLCBzcGVjaWZpZXJNYXApIHsKICBmb3IgKGxldCBzcGVjaWZpZXJLZXkgaW4gc3BlY2lmaWVyTWFwKSB7CiAgICBjb25zdCByZXNvbHV0aW9uUmVzdWx0ID0gc3BlY2lmaWVyTWFwW3NwZWNpZmllcktleV07CgogICAgaWYgKHNwZWNpZmllcktleSA9PT0gbm9ybWFsaXplZFNwZWNpZmllcikgewogICAgICBpZiAocmVzb2x1dGlvblJlc3VsdCA9PT0gbnVsbCkgewogICAgICAgIHRocm93IFR5cGVFcnJvcigKICAgICAgICAgIGBUaGUgaW1wb3J0IG1hcCByZXNvbHV0aW9uIG9mICR7c3BlY2lmaWVyS2V5fSBmYWlsZWQgZHVlIHRvIGEgbnVsbCBlbnRyeWAKICAgICAgICApOwogICAgICB9CiAgICAgIHJldHVybiByZXNvbHV0aW9uUmVzdWx0OwogICAgfSBlbHNlIGlmICgKICAgICAgc3BlY2lmaWVyS2V5LmVuZHNXaXRoKCcvJykgJiYKICAgICAgbm9ybWFsaXplZFNwZWNpZmllci5zdGFydHNXaXRoKHNwZWNpZmllcktleSkKICAgICkgewogICAgICBpZiAocmVzb2x1dGlvblJlc3VsdCA9PT0gbnVsbCkgewogICAgICAgIHRocm93IFR5cGVFcnJvcigKICAgICAgICAgIGBUaGUgaW1wb3J0IG1hcCByZXNvbHV0aW9uIG9mICR7c3BlY2lmaWVyS2V5fSBmYWlsZWQgZHVlIHRvIGEgbnVsbCBlbnRyeWAKICAgICAgICApOwogICAgICB9CiAgICAgIGNvbnN0IGFmdGVyUHJlZml4ID0gbm9ybWFsaXplZFNwZWNpZmllci5zbGljZShzcGVjaWZpZXJLZXkubGVuZ3RoKTsKICAgICAgdHJ5IHsKICAgICAgICByZXR1cm4gbmV3IFVSTChhZnRlclByZWZpeCwgcmVzb2x1dGlvblJlc3VsdCkuaHJlZjsKICAgICAgfSBjYXRjaCB7CiAgICAgICAgdGhyb3cgVHlwZUVycm9yKAogICAgICAgICAgYFRoZSBpbXBvcnQgbWFwIHJlc29sdXRpb24gb2YgJHtzcGVjaWZpZXJLZXl9IGZhaWxlZCBkdWUgdG8gVVJMIHBhcnNlIGZhaWx1cmVgCiAgICAgICAgKTsKICAgICAgfQogICAgfQogIH0KCiAgcmV0dXJuIG51bGw7Cn0KCi8vIGh0dHBzOi8vd2ljZy5naXRodWIuaW8vaW1wb3J0LW1hcHMvI3BhcnNpbmcKZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVBbmRDb21wb3NlSW1wb3J0TWFwKHBhcnNlZCkgewogIC8vIFN0ZXAgMgogIGlmICghaXNQbGFpbk9iamVjdChwYXJzZWQpKSB7CiAgICB0aHJvdyBFcnJvcihgSW52YWxpZCBpbXBvcnQgbWFwIC0gdG9wIGxldmVsIG11c3QgYmUgYW4gb2JqZWN0YCk7CiAgfQoKICAvLyBTdGVwIDMKICBsZXQgc29ydGVkQW5kTm9ybWFsaXplZEltcG9ydHMgPSB7fTsKCiAgLy8gU3RlcCA0CiAgaWYgKHBhcnNlZC5oYXNPd25Qcm9wZXJ0eSgnaW1wb3J0cycpKSB7CiAgICAvLyBTdGVwIDQuMQogICAgaWYgKCFpc1BsYWluT2JqZWN0KHBhcnNlZC5pbXBvcnRzKSkgewogICAgICB0aHJvdyBFcnJvcihgSW52YWxpZCBpbXBvcnQgbWFwIC0gImltcG9ydHMiIHByb3BlcnR5IG11c3QgYmUgYW4gb2JqZWN0YCk7CiAgICB9CgogICAgLy8gU3RlcCA0LjIKICAgIHNvcnRlZEFuZE5vcm1hbGl6ZWRJbXBvcnRzID0gc29ydEFuZE5vcm1hbGl6ZVNwZWNpZmllck1hcCgKICAgICAgcGFyc2VkLmltcG9ydHMsCiAgICAgIGJhc2VVUkwKICAgICk7CiAgfQoKICAvLyBTdGVwIDUKICBsZXQgc29ydGVkQW5kTm9ybWFsaXplZFNjb3BlcyA9IHt9OwoKICAvLyBTdGVwIDYKICBpZiAocGFyc2VkLmhhc093blByb3BlcnR5KCdzY29wZXMnKSkgewogICAgLy8gU3RlcCA2LjEKICAgIGlmICghaXNQbGFpbk9iamVjdChwYXJzZWQuc2NvcGVzKSkgewogICAgICB0aHJvdyBFcnJvcihgSW52YWxpZCBpbXBvcnQgbWFwIC0gInNjb3BlcyIgcHJvcGVydHkgbXVzdCBiZSBhbiBvYmplY3RgKTsKICAgIH0KCiAgICAvLyBTdGVwIDYuMgogICAgc29ydGVkQW5kTm9ybWFsaXplZFNjb3BlcyA9IHNvcnRBbmROb3JtYWxpemVTY29wZXMocGFyc2VkLnNjb3BlcywgYmFzZVVSTCk7CiAgfQoKICAvLyBTdGVwIDcKICBjb25zdCBpbnZhbGlkS2V5cyA9IE9iamVjdC5rZXlzKHBhcnNlZCkuZmlsdGVyKAogICAgKGtleSkgPT4ga2V5ICE9PSAnaW1wb3J0cycgJiYga2V5ICE9PSAnc2NvcGVzJwogICk7CiAgaWYgKGludmFsaWRLZXlzLmxlbmd0aCA+IDApIHsKICAgIGNvbnNvbGUud2FybigKICAgICAgYEludmFsaWQgdG9wLWxldmVsIGtleSR7CiAgICAgICAgaW52YWxpZEtleXMubGVuZ3RoID4gMCA/ICdzJyA6ICcnCiAgICAgIH0gaW4gaW1wb3J0IG1hcCAtICR7aW52YWxpZEtleXMuam9pbignLCAnKX1gCiAgICApOwogIH0KCiAgLy8gU3RlcCA4CiAgcmV0dXJuIHsKICAgIGltcG9ydHM6IHNvcnRlZEFuZE5vcm1hbGl6ZWRJbXBvcnRzLAogICAgc2NvcGVzOiBzb3J0ZWRBbmROb3JtYWxpemVkU2NvcGVzLAogIH07Cn0KCi8vIGh0dHBzOi8vd2ljZy5naXRodWIuaW8vaW1wb3J0LW1hcHMvI3NvcnQtYW5kLW5vcm1hbGl6ZS1hLXNwZWNpZmllci1tYXAKZnVuY3Rpb24gc29ydEFuZE5vcm1hbGl6ZVNwZWNpZmllck1hcChtYXAsIGJhc2VVUkwpIHsKICBjb25zdCBub3JtYWxpemVkID0ge307CgogIGZvciAobGV0IHNwZWNpZmllcktleSBpbiBtYXApIHsKICAgIGNvbnN0IHZhbHVlID0gbWFwW3NwZWNpZmllcktleV07CgogICAgY29uc3Qgbm9ybWFsaXplZFNwZWNpZmllcktleSA9IG5vcm1hbGl6ZVNwZWNpZmllcktleShzcGVjaWZpZXJLZXksIGJhc2VVUkwpOwogICAgaWYgKG5vcm1hbGl6ZWRTcGVjaWZpZXJLZXkgPT09IG51bGwpIHsKICAgICAgY29udGludWU7CiAgICB9CgogICAgbGV0IGFkZHJlc3NVUkwgPSBwYXJzZVVSTExpa2VTcGVjaWZpZXIodmFsdWUsIGJhc2VVUkwpOwogICAgaWYgKGFkZHJlc3NVUkwgPT09IG51bGwpIHsKICAgICAgY29uc29sZS53YXJuKAogICAgICAgIGBJbnZhbGlkIFVSTCBhZGRyZXNzIGZvciBpbXBvcnQgbWFwIHNwZWNpZmllciAnJHtzcGVjaWZpZXJLZXl9J2AKICAgICAgKTsKICAgICAgbm9ybWFsaXplZFtub3JtYWxpemVkU3BlY2lmaWVyS2V5XSA9IG51bGw7CiAgICAgIGNvbnRpbnVlOwogICAgfQoKICAgIGlmIChzcGVjaWZpZXJLZXkuZW5kc1dpdGgoJy8nKSAmJiAhYWRkcmVzc1VSTC5lbmRzV2l0aCgnLycpKSB7CiAgICAgIGNvbnNvbGUud2FybigKICAgICAgICBgSW52YWxpZCBVUkwgYWRkcmVzcyBmb3IgaW1wb3J0IG1hcCBzcGVjaWZpZXIgJyR7c3BlY2lmaWVyS2V5fScgLSBzaW5jZSB0aGUgc3BlY2lmaWVyIGVuZHMgaW4gc2xhc2gsIHNvIG11c3QgdGhlIGFkZHJlc3NgCiAgICAgICk7CiAgICAgIG5vcm1hbGl6ZWRbbm9ybWFsaXplZFNwZWNpZmllcktleV0gPSBudWxsOwogICAgICBjb250aW51ZTsKICAgIH0KCiAgICBub3JtYWxpemVkW25vcm1hbGl6ZWRTcGVjaWZpZXJLZXldID0gYWRkcmVzc1VSTDsKICB9CgogIHJldHVybiBub3JtYWxpemVkOwp9CgovLyBodHRwczovL3dpY2cuZ2l0aHViLmlvL2ltcG9ydC1tYXBzLyNub3JtYWxpemUtYS1zcGVjaWZpZXIta2V5CmZ1bmN0aW9uIG5vcm1hbGl6ZVNwZWNpZmllcktleShrZXkpIHsKICBpZiAoa2V5ID09PSAnJykgewogICAgY29uc29sZS53YXJuKGBTcGVjaWZpZXIga2V5cyBpbiBpbXBvcnQgbWFwcyBtYXkgbm90IGJlIHRoZSBlbXB0eSBzdHJpbmdgKTsKICAgIHJldHVybiBudWxsOwogIH0KCiAgcmV0dXJuIHBhcnNlVVJMTGlrZVNwZWNpZmllcihrZXksIGJhc2VVUkwpIHx8IGtleTsKfQoKLy8gaHR0cHM6Ly93aWNnLmdpdGh1Yi5pby9pbXBvcnQtbWFwcy8jcGFyc2UtYS11cmwtbGlrZS1pbXBvcnQtc3BlY2lmaWVyCmZ1bmN0aW9uIHBhcnNlVVJMTGlrZVNwZWNpZmllcihzcGVjaWZpZXIsIGJhc2VVUkwpIHsKICBjb25zdCB1c2VCYXNlVXJsQXNQYXJlbnQgPQogICAgc3BlY2lmaWVyLnN0YXJ0c1dpdGgoJy8nKSB8fAogICAgc3BlY2lmaWVyLnN0YXJ0c1dpdGgoJy4vJykgfHwKICAgIHNwZWNpZmllci5zdGFydHNXaXRoKCcuLi8nKTsKCiAgdHJ5IHsKICAgIHJldHVybiBuZXcgVVJMKHNwZWNpZmllciwgdXNlQmFzZVVybEFzUGFyZW50ID8gYmFzZVVSTCA6IHVuZGVmaW5lZCkuaHJlZjsKICB9IGNhdGNoIHsKICAgIHJldHVybiBudWxsOwogIH0KfQoKLy8gaHR0cHM6Ly93aWNnLmdpdGh1Yi5pby9pbXBvcnQtbWFwcy8jc29ydC1hbmQtbm9ybWFsaXplLXNjb3BlcwpmdW5jdGlvbiBzb3J0QW5kTm9ybWFsaXplU2NvcGVzKG1hcCwgYmFzZVVSTCkgewogIGxldCBub3JtYWxpemVkID0ge307CgogIGZvciAobGV0IHNjb3BlUHJlZml4IGluIG1hcCkgewogICAgY29uc3QgcG90ZW50aWFsU3BlY2lmaWVyTWFwID0gbWFwW3Njb3BlUHJlZml4XTsKICAgIGlmICghaXNQbGFpbk9iamVjdChwb3RlbnRpYWxTcGVjaWZpZXJNYXApKSB7CiAgICAgIHRocm93IFR5cGVFcnJvcigKICAgICAgICBgVGhlIHZhbHVlIG9mIHNjb3BlICR7c2NvcGVQcmVmaXh9IG11c3QgYmUgYSBKU09OIG9iamVjdGAKICAgICAgKTsKICAgIH0KCiAgICBsZXQgc2NvcGVQcmVmaXhVUkw7CiAgICB0cnkgewogICAgICBzY29wZVByZWZpeFVSTCA9IG5ldyBVUkwoc2NvcGVQcmVmaXgsIGJhc2VVUkwpLmhyZWY7CiAgICB9IGNhdGNoIHsKICAgICAgY29uc29sZS53YXJuKAogICAgICAgIGBTY29wZSBwcmVmaXggVVJMICcke3Njb3BlUHJlZml4fScgd2FzIG5vdCBwYXJzZWFibGUgaW4gaW1wb3J0IG1hcGAKICAgICAgKTsKICAgICAgY29udGludWU7CiAgICB9CgogICAgbm9ybWFsaXplZFtzY29wZVByZWZpeFVSTF0gPSBzb3J0QW5kTm9ybWFsaXplU3BlY2lmaWVyTWFwKAogICAgICBwb3RlbnRpYWxTcGVjaWZpZXJNYXAsCiAgICAgIGJhc2VVUkwKICAgICk7CiAgfQoKICByZXR1cm4gbm9ybWFsaXplZDsKfQoKZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHsKICByZXR1cm4gb2JqID09PSBPYmplY3Qob2JqKSAmJiAhQXJyYXkuaXNBcnJheShvYmopOwp9CgovLyAtLS0KCmxldCBpbXBvcnRNYXBQcm9taXNlID0gZ2V0SW1wb3J0TWFwUHJvbWlzZSgpOwoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlc29sdmUoc3BlY2lmaWVyLCBjb250ZXh0LCBkZWZhdWx0UmVzb2x2ZSkgewogIGNvbnN0IHsgcGFyZW50VVJMID0gbnVsbCB9ID0gY29udGV4dDsKICBjb25zdCBpbXBvcnRNYXAgPSBhd2FpdCBpbXBvcnRNYXBQcm9taXNlOwogIGNvbnN0IGltcG9ydE1hcFVybCA9IHJlc29sdmVTcGVjaWZpZXIoaW1wb3J0TWFwLCBzcGVjaWZpZXIsIHBhcmVudFVSTCk7CgogIHJldHVybiBkZWZhdWx0UmVzb2x2ZShpbXBvcnRNYXBVcmwgPz8gc3BlY2lmaWVyLCBjb250ZXh0LCBkZWZhdWx0UmVzb2x2ZSk7Cn0KCmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkKHVybCwgY29udGV4dCwgZGVmYXVsdExvYWQpIHsKICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fCB1cmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSkgewogICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsKTsKICAgIGlmICghcmVzLm9rKSB7CiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZldGNoIG1vZHVsZSBmcm9tICR7dXJsfWApOwogICAgfQogICAgY29uc3Qgc291cmNlID0gYXdhaXQgcmVzLnRleHQoKTsKICAgIHJldHVybiB7CiAgICAgIHNob3J0Q2lyY3VpdDogdHJ1ZSwKICAgICAgZm9ybWF0OiAnbW9kdWxlJywgCiAgICAgIHNvdXJjZSwKICAgIH07CiAgfQoKICBpZiAoIXVybC5zdGFydHNXaXRoKCdub2RlOicpKSB7CiAgICBjb250ZXh0LmZvcm1hdCA9ICdtb2R1bGUnOwogIH0KICAKICByZXR1cm4gZGVmYXVsdExvYWQodXJsLCBjb250ZXh0LCBkZWZhdWx0TG9hZCk7Cn0KCmFzeW5jIGZ1bmN0aW9uIGdldEltcG9ydE1hcFByb21pc2UoKSB7CiAgY29uc3QgcmVsYXRpdmVQYXRoID0gcHJvY2Vzcy5lbnYuSU1QT1JUX01BUF9QQVRIIHx8IElNUE9SVF9NQVBfRklMRV9OQU1FOwogIGNvbnN0IGltcG9ydE1hcFBhdGggPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgcmVsYXRpdmVQYXRoKTsKCiAgbGV0IHN0cjsKICB0cnkgewogICAgc3RyID0gYXdhaXQgZnMucmVhZEZpbGUoaW1wb3J0TWFwUGF0aCk7CiAgfSBjYXRjaCAoZXJyKSB7CiAgICByZXR1cm4gZW1wdHlNYXAoKTsKICB9CgogIGxldCBqc29uOwogIHRyeSB7CiAgICBqc29uID0gYXdhaXQgSlNPTi5wYXJzZShzdHIpOwogIH0gY2F0Y2ggKGVycikgewogICAgdGhyb3cgRXJyb3IoCiAgICAgIGBJbXBvcnQgbWFwIGF0ICR7aW1wb3J0TWFwUGF0aH0gY29udGFpbnMgaW52YWxpZCBqc29uOiAke2Vyci5tZXNzYWdlfWAKICAgICk7CiAgfQoKICByZXR1cm4gcmVzb2x2ZUFuZENvbXBvc2VJbXBvcnRNYXAoanNvbik7Cn0KCmdsb2JhbC5ub2RlTG9hZGVyID0gZ2xvYmFsLm5vZGVMb2FkZXIgfHwge307CgpnbG9iYWwubm9kZUxvYWRlci5zZXRJbXBvcnRNYXBQcm9taXNlID0gZnVuY3Rpb24gc2V0SW1wb3J0TWFwUHJvbWlzZShwcm9taXNlKSB7CiAgaW1wb3J0TWFwUHJvbWlzZSA9IHByb21pc2UudGhlbigobWFwKSA9PiB7CiAgICByZXR1cm4gcmVzb2x2ZUFuZENvbXBvc2VJbXBvcnRNYXAobWFwKTsKICB9KTsKfTsKCmZ1bmN0aW9uIGVtcHR5TWFwKCkgewogIHJldHVybiB7IGltcG9ydHM6IHt9LCBzY29wZXM6IHt9IH07Cn0K";

// libs/native-federation-node/src/lib/node/init-node-federation.ts
var defaultOptions = {
  remotesOrManifestUrl: {},
  relBundlePath: "../browser",
  throwIfRemoteNotFound: false
};
async function initNodeFederation(options) {
  const mergedOptions = { ...defaultOptions, ...options };
  const importMap = await createNodeImportMap(mergedOptions);
  await writeImportMap(importMap);
  await writeResolver();
  register(pathToFileURL("./federation-resolver.mjs").href);
}
async function createNodeImportMap(options) {
  const { remotesOrManifestUrl, relBundlePath } = options;
  const remotes = typeof remotesOrManifestUrl === "object" ? remotesOrManifestUrl : await loadFsManifest(remotesOrManifestUrl);
  const hostInfo = await loadFsFederationInfo(relBundlePath);
  const hostImportMap = await processHostInfo(hostInfo, "./" + relBundlePath);
  const remotesImportMap = await processRemoteInfos(remotes, {
    throwIfRemoteNotFound: options.throwIfRemoteNotFound,
    cacheTag: options.cacheTag
  });
  const importMap = mergeImportMaps(hostImportMap, remotesImportMap);
  return importMap;
}
async function loadFsManifest(manifestUrl) {
  const content = await fs2.readFile(manifestUrl, "utf-8");
  const manifest = JSON.parse(content);
  return manifest;
}
async function loadFsFederationInfo(relBundlePath) {
  const manifestPath = path2.join(relBundlePath, "remoteEntry.json");
  const content = await fs2.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(content);
  return manifest;
}
async function writeImportMap(map) {
  await fs2.writeFile(
    IMPORT_MAP_FILE_NAME,
    JSON.stringify(map, null, 2),
    "utf-8"
  );
}
async function writeResolver() {
  const buffer = Buffer.from(resolver, "base64");
  await fs2.writeFile("federation-resolver.mjs", buffer, "utf-8");
}

// libs/native-federation-node/src/lib/utils/fstart-args-parser.ts
import * as fs3 from "node:fs";
var defaultArgs = {
  entry: "./server.mjs",
  remotesOrManifestUrl: "../browser/federation.manifest.json",
  relBundlePath: "../browser/"
};
function parseFStartArgs() {
  const args2 = {
    entry: "",
    remotesOrManifestUrl: "",
    relBundlePath: ""
  };
  let key = "";
  for (let i = 2; i < process.argv.length; i++) {
    const cand = process.argv[i];
    if (cand.startsWith("--")) {
      const candKey = cand.substring(2);
      if (defaultArgs[candKey]) {
        key = candKey;
      } else {
        console.error(`switch ${cand} not supported!`);
        exitWithUsage(defaultArgs);
      }
    } else if (key) {
      args2[key] = cand;
      key = "";
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
    const cand = defaultArgs.relBundlePath + "federation.manifest.json";
    if (fs3.existsSync(cand)) {
      args2.remotesOrManifestUrl = cand;
    }
  }
  args2.entry = args2.entry || defaultArgs.entry;
  args2.relBundlePath = args2.relBundlePath || defaultArgs.relBundlePath;
  args2.remotesOrManifestUrl = args2.remotesOrManifestUrl || defaultArgs.remotesOrManifestUrl;
  if (!fs3.existsSync(args2.remotesOrManifestUrl)) {
    args2.remotesOrManifestUrl = void 0;
  }
}
function exitWithUsage(defaultArgs2) {
  let args2 = "";
  for (const key in defaultArgs2) {
    args2 += `[--${key} ${defaultArgs2[key]}] `;
  }
  console.log("usage: nfstart " + args2);
  process.exit(1);
}

// libs/native-federation-node/src/lib/utils/fstart.ts
var args = parseFStartArgs();
(async () => {
  await initNodeFederation({
    ...args.remotesOrManifestUrl ? { remotesOrManifestUrl: args.remotesOrManifestUrl } : {},
    relBundlePath: args.relBundlePath
  });
  await import(args.entry);
})();
