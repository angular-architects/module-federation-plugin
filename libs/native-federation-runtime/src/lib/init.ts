import { FederationInfo } from '@angular-architects/native-federation';
import 'es-module-shims';

export async function initFederation() {
    
    const host = await fetch('./remoteEntry.json').then(r => r.json()) as FederationInfo;
    const imports = host.shared.reduce( (acc, cur) => ({...acc, [cur.packageName]: './' + cur.outFileName }) ,{});

    // importShim.addImportMap(importMap);

    document.body.appendChild(Object.assign(document.createElement('script'), {
        type: 'importmap-shim',
        innerHTML: JSON.stringify({ imports }),
      }));

    // window.importShim
}
