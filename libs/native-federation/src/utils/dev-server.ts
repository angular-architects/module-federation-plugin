import * as browserSync from 'browser-sync';
import { NfBuilderSchema } from '../builders/build/schema';

let server: browserSync.BrowserSyncInstance;

export function startServer(options: NfBuilderSchema, path: string): void {
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
  });
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
