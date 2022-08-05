import { initFederation } from '@angular-architects/native-federation-runtime';

initFederation()
    .then(() => import('./bootstrap'))
    .catch(e => console.error('err', e));