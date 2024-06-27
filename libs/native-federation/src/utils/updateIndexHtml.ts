import * as path from 'path';
import * as fs from 'fs';
import { FederationOptions } from '@softarc/native-federation/build';
import { NfBuilderSchema } from '../builders/build/schema';

export function updateIndexHtml(fedOptions: FederationOptions) {
  const outputPath = path.join(fedOptions.workspaceRoot, fedOptions.outputPath);
  const indexPath = path.join(outputPath, 'index.html');
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
  );
  fs.writeFileSync(indexPath, indexContent, 'utf-8');
}

export function updateScriptTags(
  indexContent: string,
  mainName: string,
  polyfillsName: string,
) {
  const esmsOptions = {
    shimMode: true,
  };

  const htmlFragment = `
<script type="esms-options">${JSON.stringify(esmsOptions)}</script>

<script type="module" src="${polyfillsName}"></script>
<script type="module-shim" src="${mainName}"></script>
`;

  indexContent = indexContent.replace(
    /<script src="polyfills.*?><\/script>/,
    ''
  );
  indexContent = indexContent.replace(/<script src="main.*?><\/script>/, '');
  indexContent = indexContent.replace('</body>', `${htmlFragment}</body>`);
  return indexContent;
}

export function transformIndexHtml(): (content: string) => Promise<string> {
  return (content: string): Promise<string> =>
    Promise.resolve(
      updateScriptTags(content, 'main.js', 'polyfills.js')
    );
}