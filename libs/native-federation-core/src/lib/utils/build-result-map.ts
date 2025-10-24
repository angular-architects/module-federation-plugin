import path from 'path';
import { BuildResult } from '../core/build-adapter';

export function createBuildResultMap(
  buildResult: BuildResult[],
  isHashed: boolean
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const item of buildResult) {
    const resultName = path.basename(item.fileName);
    let requestName = resultName;

    if (isHashed) {
      const start = resultName.lastIndexOf('-');
      const end = resultName.lastIndexOf('.');

      const part1 = resultName.substring(0, start);
      const part2 = resultName.substring(end);

      requestName = part1 + part2;
    }
    map[requestName] = resultName;
  }

  return map;
}

export function lookupInResultMap(
  map: Record<string, string>,
  requestName: string
): string {
  const key = path.basename(requestName);
  return map[key];
}
