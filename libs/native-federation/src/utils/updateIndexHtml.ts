import * as path from 'path';
import * as fs from 'fs';
import { FederationOptions } from '@softarc/native-federation/build';
import { NfBuilderSchema } from '../builders/build/schema';

export function updateIndexHtml(
  fedOptions: FederationOptions,
  nfOptions: NfBuilderSchema,
) {
  const outputPath = path.resolve(
    fedOptions.workspaceRoot,
    fedOptions.outputPath,
  );
  const indexPathCands = [
    path.join(outputPath, '../server/index.server.html'),
    path.join(outputPath, 'index.html'),
  ];

  const indexPath = indexPathCands.find((c) => fs.existsSync(c));

  if (!indexPath) {
    console.error(
      'No index.html found! Searched locations: ',
      indexPathCands.join(', '),
    );
    return;
  }

  const mainName = fs
    .readdirSync(outputPath)
    .find((f) => f.startsWith('main') && f.endsWith('.js'));
  const polyfillsName = fs
    .readdirSync(outputPath)
    .find((f) => f.startsWith('polyfills') && f.endsWith('.js'));

  let indexContent = fs.readFileSync(indexPath, 'utf-8');

  indexContent = updateScriptTags(
    indexContent,
    mainName,
    polyfillsName,
    nfOptions,
  );
  fs.writeFileSync(indexPath, indexContent, 'utf-8');
}

export function updateScriptTags(
  indexContent: string,
  mainName: string,
  polyfillsName: string,
  nfOptions: NfBuilderSchema,
) {
  const esmsOptions = {
    shimMode: true,
    ...nfOptions.esmsInitOptions,
  };

  // A module-shim main tag makes es-module-shims force shim mode back on, so
  // an explicit shimMode: false must emit a real module script.
  const mainType = esmsOptions.shimMode === false ? 'module' : 'module-shim';

  const htmlFragment = `
<script type="esms-options">${JSON.stringify(esmsOptions)}</script>
`;

  indexContent = indexContent.replace(
    /<script\s+src="([^"]*polyfills[^"]*)"[^>]*><\/script>/,
    '<script type="module" src="$1"></script>',
  );
  indexContent = indexContent.replace(
    /<script\s+src="([^"]*main[^"]*)"[^>]*><\/script>/,
    `<script type="${mainType}" src="$1"></script>`,
  );

  indexContent = indexContent.replace(/(<body.*?>)/, `$1\n\t\t${htmlFragment}`);
  return indexContent;
}
