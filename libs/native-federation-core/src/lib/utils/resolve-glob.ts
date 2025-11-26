import * as fs from 'fs';
import * as path from 'path';

export function resolveGlobSync(
  pattern: string,
  baseDir = process.cwd(),
): string[] {
  if (pattern.startsWith('./')) {
    pattern = pattern.substring(2);
  }

  const segments = pattern.split('/').filter(Boolean);
  const results: string[] = [];

  function search(dir: string, segmentIndex: number) {
    if (segmentIndex >= segments.length) {
      results.push(dir);
      return;
    }

    const segment = segments[segmentIndex];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    if (segment === '*') {
      entries
        .filter((entry) => entry.isDirectory())
        .forEach((entry) =>
          search(path.join(dir, entry.name), segmentIndex + 1),
        );
    } else {
      entries
        .filter((entry) => entry.name === segment)
        .forEach((entry) =>
          search(path.join(dir, entry.name), segmentIndex + 1),
        );
    }
  }

  search(baseDir, 0);
  return results;
}
