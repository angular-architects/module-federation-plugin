import * as path from 'path';
import * as fs from 'fs';
import { BuildOutputFile } from '@angular-devkit/build-angular/src/tools/esbuild/bundler-context';
import { FederationOptions } from '@softarc/native-federation/build';

export function updateIndexHtml(
  fedOptions: FederationOptions,
  file: BuildOutputFile,
) {
  const dir = path.join(
    fedOptions.workspaceRoot,
    fedOptions.outputPath,
    path.dirname(file.path),
  );
  const mainName = fs
    .readdirSync(dir)
    .find((f) => f.startsWith('main') && f.endsWith('.js'));
  const polyfillsName = fs
    .readdirSync(dir)
    .find((f) => 
      f.startsWith('polyfills') &&
      f.endsWith('.js') &&
      !fs.readFileSync(path.join(dir, f), 'utf-8')
        .includes('import"@angular/common/locales/global/')
    );

  let indexContent = updateScriptTags(file.text, mainName, polyfillsName);
  fs.writeFileSync(
    path.join(dir, path.basename(file.path)),
    indexContent,
    'utf-8',
  );
}

export function updateScriptTags(
  indexContent: string,
  mainName: string,
  polyfillsName: string,
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
