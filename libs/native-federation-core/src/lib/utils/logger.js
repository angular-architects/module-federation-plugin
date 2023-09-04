"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLogLevel = exports.logger = void 0;
const tslib_1 = require("tslib");
const npmlog_1 = tslib_1.__importDefault(require("npmlog"));
const levels = npmlog_1.default.levels;
npmlog_1.default.addLevel('error', levels.error, { fg: 'brightWhite', bg: 'red' }, ' ERR! ');
npmlog_1.default.addLevel('warn', levels.info, { fg: 'brightWhite', bg: 'yellow' }, ' WARN ');
npmlog_1.default.addLevel('info', levels.warn, { fg: 'brightWhite', bg: 'green' }, ' INFO ');
npmlog_1.default.addLevel('notice', levels.notice, { fg: 'black', bg: 'brightYellow' }, ' NOTE ');
npmlog_1.default.addLevel('verbose', levels.verbose, { fg: 'brightWhite', bg: 'brightBlue' }, ' VRB! ');
npmlog_1.default.addLevel('silly', levels.silly, { fg: 'black', bg: 'white' }, ' DBG! ');
// export const error = (msg: any) => log.error('', msg);
// export const warn = (msg: any) => log.warn('', msg);
// export const notice = (msg: any) => log.notice('', msg);
// export const info = (msg: any) => log.info('', msg);
// export const verbose = (msg: any) => log.verbose('', msg);
// export const debug = (msg: any) => log.silly('', msg);
exports.logger = {
    error: (msg) => npmlog_1.default.error('', msg),
    warn: (msg) => npmlog_1.default.warn('', msg),
    notice: (msg) => npmlog_1.default.notice('', msg),
    info: (msg) => npmlog_1.default.info('', msg),
    verbose: (msg) => npmlog_1.default.verbose('', msg),
    debug: (msg) => npmlog_1.default.silly('', msg),
};
const setLogLevel = (level) => {
    npmlog_1.default.level = level === 'debug' ? 'silly' : level;
};
exports.setLogLevel = setLogLevel;
(0, exports.setLogLevel)('info');
// log.error('', {x:1} as any);
// log.warn('', 'bla');
// log.notice('', 'bla');
// log.info('', 'bla');
// log.verbose('', 'bla');
// log.silly('', 'bla');
//# sourceMappingURL=logger.js.map