import crypt = require("crypto");
import chalk = require("chalk");

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

export function print(prefix: string, prefixSize: number, message: string, error = false): void {
    
  const hash = crypt.createHash("sha256")
        .update(prefix)
        .digest("hex");
    
    const color = '#' + correctColor(hash.substring(6,12));
    
    prefix = prefix.padEnd(prefixSize);

    if (message.endsWith('\n')) {
        message = message.substring(0, message.length-1);
    }

  const coloredPrefix = chalk.hex(color)(prefix) + ' | ';
  const lines = message.split('\n');

  const lineSize = process.stdout.columns - prefixSize - 10;

  for (const line of lines) {
    for (const subline of wrap(line, lineSize)) {
      console.log(`${coloredPrefix}${error ? chalk.redBright(subline) : subline}`);
    }
  }
}

function* wrap(text: string, width: number): Generator<string, void, never> {
  let line = '';

  for (const word of text.split(/\s+/)) {
      if (line.length + (1 + word.length) > width) {
        yield line.trim();
        
        line = word;
      }
      else {
        line = line + ' ' + word;
      }
  }
    
  yield line.trim();
}
