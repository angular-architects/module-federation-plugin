import * as fs from 'fs';

export function copySrcMapIfExists(cachedFile: string, fullOutputPath: string) {
  const mapSrc = cachedFile + '.map';
  const mapDest = fullOutputPath + '.map';

  if (fs.existsSync(mapSrc)) {
    fs.copyFileSync(mapSrc, mapDest);
  }
}
