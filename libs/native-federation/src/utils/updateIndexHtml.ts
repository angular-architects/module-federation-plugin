import * as path from 'path';
import * as fs from 'fs';
import { BuildOutputFile } from '@angular-devkit/build-angular/src/tools/esbuild/bundler-context';

export function updateIndexHtml(file: BuildOutputFile) {
  const dir = path.dirname(file.fullOutputPath);
  const mainName = fs
    .readdirSync(dir)
    .find((f) => f.startsWith('main') && f.endsWith('.js'));
  const polyfillsName = fs
    .readdirSync(dir)
    .find((f) => f.startsWith('polyfills') && f.endsWith('.js'));

  let indexContent = updateScriptTags(file.text, mainName, polyfillsName);
  fs.writeFileSync(file.fullOutputPath, indexContent, 'utf-8');
}

export function updateScriptTags(
  indexContent: string,
  mainName: string,
  polyfillsName: string
) {
  const htmlFragment = `
<script type="esms-options">
{
  "shimMode": true
}
</script>

<script type="module" src="${polyfillsName}"></script>
<script type="module-shim" src="${mainName}"></script>
`;

  indexContent = indexContent.replace(/<script src="polyfills.*?>/, '');
  indexContent = indexContent.replace(/<script src="main.*?>/, '');
  indexContent = indexContent.replace('</body>', `${htmlFragment}</body>`);
  return indexContent;
}
