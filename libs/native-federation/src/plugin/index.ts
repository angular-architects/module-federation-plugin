import * as fs from 'fs';
import * as path from 'path';

import { lookup } from 'mrmime';
import { devExternalsMixin } from './dev-externals-mixin';
import { filterExternals } from './externals-skip-list';
import {
  BuildHelperParams,
  federationBuilder,
} from '@softarc/native-federation/build';
import { FederationInfo } from '@softarc/native-federation-runtime';

type FedInfoRef = { federationInfo: FederationInfo };

export const federation = (params: BuildHelperParams) => {
  return {
    ...devExternalsMixin,
    name: '@module-federation/vite', // required, will show up in warnings and errors
    async config(...args) {
      await federationBuilder.init(params);
      devExternalsMixin.config(...args);
    },
    options(o: unknown) {
      o!['external'] = filterExternals(federationBuilder.externals);
    },
    async closeBundle() {
      await federationBuilder.build();
    },
    async configureServer(server) {
      const fedInfoRef: FedInfoRef = {
        federationInfo: federationBuilder.federationInfo,
      };
      await configureDevServer(server, params, fedInfoRef);
    },
    transformIndexHtml(html: string) {
      const fragment = '<script src="polyfills.js" type="module-shim">';
      const updated = `
<script type="esms-options">
{
"shimMode": true
}
</script>
<script src="polyfills.js" type="module">
`;
      html = html.replace(/type="module"/g, 'type="module-shim"');
      return html.replace(fragment, updated);
    },
  };
};

const configureDevServer = async (
  server: any,
  params: BuildHelperParams,
  fedInfo: FedInfoRef
) => {
  await federationBuilder.build();

  const op = params.options;
  const dist = path.join(op.workspaceRoot, op.outputPath);
  server.middlewares.use(serveFromDist(dist, fedInfo));
};

const serveFromDist = (dist: string, fedInfoRef: FedInfoRef) => {
  const fedFiles = new Set([
    ...fedInfoRef.federationInfo.shared.map((s) =>
      path.join('/', s.outFileName)
    ),
    ...fedInfoRef.federationInfo.exposes.map((e) =>
      path.join('/', e.outFileName)
    ),
    '/remoteEntry.json',
  ]);

  return (req, res, next) => {
    if (!req.url || req.url.endsWith('/index.html') || !fedFiles.has(req.url)) {
      next();
      return;
    }

    const file = path.join(dist, req.url);
    if (fs.existsSync(file) && fs.lstatSync(file).isFile()) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      const type = lookup(req.url) || '';
      res.setHeader('Content-Type', type);

      const content = fs.readFileSync(file, 'utf-8');
      //   const modified = enhanceFile(file, content);
      const modified = content;
      res.write(modified);
      res.end();
      return;
    }

    next();
  };
};

// TODO: Unused, to delete?
// const enhanceFile = (fileName: string, src: string): string => {
//   if (fileName.endsWith('remoteEntry.json')) {
//     let remoteEntry = JSON.parse(fs.readFileSync(fileName, 'utf-8'));
//     remoteEntry = {
//       ...remoteEntry,
//       shared: (remoteEntry.shared || []).map((el) => ({
//         ...el,
//         outFileName: el.dev?.entryPoint.includes('/node_modules/')
//           ? el.outFileName
//           : normalize(path.join('@fs', el.dev?.entryPoint || '')),
//       })),
//       exposes: (remoteEntry.exposes || []).map((el) => ({
//         ...el,
//         outFileName: normalize(path.join('@fs', el.dev?.entryPoint || '')),
//       })),
//     };
//     return JSON.stringify(remoteEntry, null, 2);
//   }
//   return src;
// };

// TODO: Unused, to delete?
// const normalize = (path: string): string => {
//   return path.replace(/\\/g, '/');
// };
