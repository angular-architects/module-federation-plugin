/* eslint-disable @typescript-eslint/no-explicit-any */

import log from 'npmlog';
import { LogLevels } from 'npmlog';

const levels = (log as any).levels;

log.addLevel('error', levels.error, { fg: 'brightWhite', bg: 'red' }, ' ERR! ');
log.addLevel(
  'warn',
  levels.info,
  { fg: 'brightWhite', bg: 'yellow' },
  ' WARN '
);
log.addLevel('info', levels.warn, { fg: 'brightWhite', bg: 'green' }, ' INFO ');
log.addLevel(
  'notice',
  levels.notice,
  { fg: 'black', bg: 'brightYellow' },
  ' NOTE '
);
log.addLevel(
  'verbose',
  levels.verbose,
  { fg: 'brightWhite', bg: 'brightBlue' },
  ' VRB! '
);
log.addLevel('silly', levels.silly, { fg: 'black', bg: 'white' }, ' DBG! ');

// export const error = (msg: any) => log.error('', msg);
// export const warn = (msg: any) => log.warn('', msg);
// export const notice = (msg: any) => log.notice('', msg);
// export const info = (msg: any) => log.info('', msg);
// export const verbose = (msg: any) => log.verbose('', msg);
// export const debug = (msg: any) => log.silly('', msg);

export const logger = {
  error: (msg: any) => log.error('', msg),
  warn: (msg: any) => log.warn('', msg),
  notice: (msg: any) => log.notice('', msg),
  info: (msg: any) => log.info('', msg),
  verbose: (msg: any) => log.verbose('', msg),
  debug: (msg: any) => log.silly('', msg),
};

export const setLogLevel = (level: LogLevels | 'debug') => {
  log.level = level === 'debug' ? 'silly' : level;
};

setLogLevel('info');

// log.error('', {x:1} as any);
// log.warn('', 'bla');
// log.notice('', 'bla');
// log.info('', 'bla');
// log.verbose('', 'bla');
// log.silly('', 'bla');
