export const DEFAULT_SERVER_DEPS_LIST: string[] = [
  '@angular/platform-server',
  '@angular/platform-server/init',
  '@angular/ssr',
];

export function getDefaultPlatform(cur: string): 'browser' | 'node' {
  if (DEFAULT_SERVER_DEPS_LIST.find(e => cur.startsWith(e))) {
    return 'node';
  } else {
    return 'browser';
  }
}
