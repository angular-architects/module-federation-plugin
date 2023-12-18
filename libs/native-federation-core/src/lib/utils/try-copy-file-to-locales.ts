import path from 'path';
import fs from 'fs';
import { FederationOptions } from '../core/federation-options';

export function tryCopyFileToLocales(sourceFile: string, fedOptions: FederationOptions) {

  if (!fedOptions.locales?.length) {
    // in case the project has not specified localization, ignore this step
    return;
  }
  const sourceBaseName = path.basename(sourceFile);
  
  for (const locale of fedOptions.locales) {
    const fullOutputPath = path.join(
        fedOptions.workspaceRoot,
        fedOptions.outputPath,
        locale
    );
    const destinationFile = path.join(fullOutputPath, sourceBaseName);
    fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true });
    
    if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, destinationFile);
    }
    const [sourceMapFile, destinationMapFile] = [sourceFile, destinationFile].map(f => f + '.map');
    if (fs.existsSync(sourceMapFile)) {
        fs.copyFileSync(sourceMapFile, destinationMapFile);
    }
  }
}