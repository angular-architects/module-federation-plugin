import { ImportMap } from '../model/import-map';
import { tryCreateTrustedScript } from './trusted-types';

export function appendImportMap(importMap: ImportMap) {
  document.head.appendChild(
    Object.assign(document.createElement('script'), {
      type: tryCreateTrustedScript('importmap-shim'),
      textContent: tryCreateTrustedScript(JSON.stringify(importMap)),
    }),
  );
}
