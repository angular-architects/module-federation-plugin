"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBuildAdapter = exports.setBuildAdapter = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("../utils/logger");
let _buildAdapter = () => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    // TODO: add logger
    logger_1.logger.error('Please set a BuildAdapter!');
    return [];
});
function setBuildAdapter(buildAdapter) {
    _buildAdapter = buildAdapter;
}
exports.setBuildAdapter = setBuildAdapter;
function getBuildAdapter() {
    return _buildAdapter;
}
exports.getBuildAdapter = getBuildAdapter;
//# sourceMappingURL=build-adapter.js.map