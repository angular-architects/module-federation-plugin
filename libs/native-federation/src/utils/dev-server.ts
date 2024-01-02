import * as browserSync from 'browser-sync';
import { NfBuilderSchema } from '../builders/build/schema';
import { BuildResult, MemResults } from './mem-resuts';
import { extname } from 'path';
import { lookup } from 'mrmime';
import { updateScriptTags } from './updateIndexHtml';

let server: browserSync.BrowserSyncInstance;

export function startServer(
  options: NfBuilderSchema,
  path: string,
  memResults: MemResults
): void {
  const projectName = options.target.split(':')[0];

  server = browserSync.create(projectName);

  server.init({
    port: options.port || 4200,
    cors: true,
    server: path,
    notify: false,
    single: true,
    ui: false,
    open: options.open,
    https: options.https ? {
      cert: options.cert,
      key: options.key
    } : false,
    middleware: [
      function (req, res, next) {
        const temp = req.url.startsWith('/') ? req.url.substring(1) : req.url;
        const key =
          temp.indexOf('?') > -1 ? temp.substring(0, temp.indexOf('?')) : temp;

        const result = memResults.get(key);

        if (result) {
          const mimeType = lookup(extname(key)) || 'text/javascript';
          const body = getBody(result, memResults);
          res.writeHead(200, {
            'Content-Type': mimeType,
          });
          res.end(body);
        } else {
          next();
        }
      },
    ],
  });
}

let buildError = '';

export function setError(error: string): void {
  buildError = error;
}

export function notifyServer(message: string): void {
  server.notify(message);
}

export function reloadBrowser(): void {
  if (!server) {
    throw new Error('server is not started');
  }
  server.reload();
}

export function reloadShell(shellProjectName: string): void {
  if (!server) {
    throw new Error('server is not started');
  }
  if (!shellProjectName) {
    return;
  }
  if (browserSync.has(shellProjectName)) {
    const shellServer = browserSync.get(shellProjectName);
    shellServer.reload();
  }
}

function modifyIndexHtml(content: string, fileNames: string[]): string {
  if (buildError) {
    const errorHtml = `
    <div style="position: absolute; filter: opacity(80%); top:0; bottom:0; left:0; right:0; padding:20px; background-color:black; color:white; ">
      <h2>${buildError}</h2>
    </div>
  `;
    content = errorHtml + content;
  }

  const mainName = fileNames.find(
    (f) => f.startsWith('main.') && f.endsWith('.js')
  );
  const polyfillsName = fileNames.find(
    (f) => f.startsWith('polyfills.') && f.endsWith('.js')
  );

  const index = updateScriptTags(content, mainName, polyfillsName);
  return index;
}

function getBody(
  result: BuildResult,
  memResults: MemResults
): Uint8Array | Buffer | string {
  const body = result.get();
  if (result.fileName === 'index.html') {
    const content = new TextDecoder().decode(body);
    return modifyIndexHtml(content, memResults.getFileNames());
  } else {
    return body;
  }
}
