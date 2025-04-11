import { initFederation } from '@angular-architects/native-federation';

initFederation({
  //'mfe1': 'http://localhost:3001/remoteEntry.json'
})
  .catch((err) => console.error(err))
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));
