/* eslint-disable @typescript-eslint/no-explicit-any */

import chalk from 'chalk';

let verbose = false;

export const logger = {
  warn: (msg: any)    => console.warn(chalk.bgYellow.ansi256(15)(' WARN '), msg),
  error: (msg: any)   => console.error(chalk.bgRed.ansi256(15)(' ERRR '), msg),
  notice: (msg: any) => console.log(chalk.bgYellowBright.black(' NOTE '), msg),
  info: (msg: any) => console.log(chalk.bgGreen.ansi256(15)(' INFO '), msg),
  verbose: (msg: any) => verbose && console.log(chalk.bgGreen.ansi256(15)(' DBG! '), msg),
  debug: (msg: any) => verbose && console.log(chalk.bgGreen.ansi256(15)(' DBG! '), msg),
};

export const setLogLevel = (level: string) => {
  verbose = level === 'verbose';
};
