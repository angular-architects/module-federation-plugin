'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.getMappedPaths = void 0;
const tslib_1 = require('tslib');
const path = tslib_1.__importStar(require('path'));
const fs = tslib_1.__importStar(require('fs'));
const JSON5 = tslib_1.__importStar(require('json5'));
function getMappedPaths({ rootTsConfigPath, sharedMappings, rootPath }) {
  var _a;
  const result = [];
  if (!path.isAbsolute(rootTsConfigPath)) {
    throw new Error(
      'SharedMappings.register: tsConfigPath needs to be an absolute path!'
    );
  }
  if (!rootPath) {
    rootPath = path.normalize(path.dirname(rootTsConfigPath));
  }
  const shareAll = !sharedMappings;
  if (!sharedMappings) {
    sharedMappings = [];
  }
  const tsConfig = JSON5.parse(
    fs.readFileSync(rootTsConfigPath, { encoding: 'utf-8' })
  );
  const mappings =
    (_a =
      tsConfig === null || tsConfig === void 0
        ? void 0
        : tsConfig.compilerOptions) === null || _a === void 0
      ? void 0
      : _a.paths;
  if (!mappings) {
    return result;
  }
  for (const key in mappings) {
    const libPath = path.normalize(path.join(rootPath, mappings[key][0]));
    if (sharedMappings.includes(key) || shareAll) {
      result.push({
        key,
        path: libPath,
      });
    }
  }
  return result;
}
exports.getMappedPaths = getMappedPaths;
//# sourceMappingURL=mapped-paths.js.map
