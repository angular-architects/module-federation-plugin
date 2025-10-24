import crypt = require('crypto');
import chalk from 'chalk';
import wordWrap = require('word-wrap');

function correctColor(color: string): string {
  let result = '';
  for (let i = 0; i < color.length; i += 2) {
    const a = color.charAt(i);
    const b = color.charAt(i + 1);

    const ia = parseInt(a);
    if (isNaN(ia)) {
      result += a;
    } else if (ia < 5) {
      result += (ia + 5).toString(16);
    } else {
      result += a;
    }

    result += b;
  }

  return result;
}

export function print(
  prefix: string,
  prefixSize: number,
  message: string,
  error = false
): void {
  const hash = crypt.createHash('sha256').update(prefix).digest('hex');

  const color = '#' + correctColor(hash.substring(6, 12));

  prefix = prefix.padEnd(prefixSize);

  if (message.endsWith('\n')) {
    message = message.substring(0, message.length - 1);
  }

  const coloredPrefix = chalk.hex(color)(prefix) + ' | ';
  const lines = message.split('\n');

  const lineSize = process.stdout.columns - prefixSize - 10;

  for (const line of lines) {
    const wrapped = wordWrap(line, { width: lineSize });
    const sublines = wrapped.split('\n');
    for (const subline of sublines) {
      const trimmed = subline.trim();
      const coloredSubline = error ? chalk.redBright(trimmed) : trimmed;
      const output = coloredPrefix + coloredSubline;
      console.log(output);
    }
  }
}
