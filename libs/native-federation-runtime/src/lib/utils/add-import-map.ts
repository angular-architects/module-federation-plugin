import { ImportMap } from '../model/import-map';

export function appendImportMap(importMap: ImportMap) {
  document.head.appendChild(
    Object.assign(document.createElement('script'), {
      type: 'importmap-shim',
      innerHTML: JSON.stringify(importMap),
    }),
  );
}
