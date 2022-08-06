import { ImportMap } from "./import-map";

export function appendImportMap(importMap: ImportMap) {
    document.body.appendChild(Object.assign(document.createElement('script'), {
        type: 'importmap-shim',
        innerHTML: JSON.stringify(importMap),
    }));
}