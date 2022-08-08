import { initFederation } from '@angular-architects/native-federation';

initFederation({
  // 'mfe1': 'http://localhost:3001/remoteEntry.json'
})
  .then(() => import('./bootstrap'))
  .catch((e) => console.error('err', e));
