export type SkipFn = (name: string) => boolean;
export type SkipListEntry = string | RegExp | SkipFn;
export type SkipList = SkipListEntry[];

export const DEFAULT_SKIP_LIST: SkipList = [
  '@softarc/native-federation-runtime',
  '@softarc/native-federation',
  '@softarc/native-federation-core',
  '@softarc/native-federation-esbuild',
  '@angular-architects/native-federation',
  '@angular-architects/native-federation-runtime',
  'es-module-shims',
  'zone.js',
  'tslib/',
  '@angular/localize',
  '@angular/localize/init',
  '@angular/localize/tools',
  /\/schematics(\/|$)/,
  (pkg) => pkg.startsWith('@angular/') && !!pkg.match(/\/testing(\/|$)/),
  (pkg) => pkg.startsWith('@types/'),
];

export const PREPARED_DEFAULT_SKIP_LIST = prepareSkipList(DEFAULT_SKIP_LIST);

export type PreparedSkipList = {
  strings: Set<string>;
  functions: SkipFn[];
  regexps: RegExp[];
};

export function prepareSkipList(skipList: SkipList): PreparedSkipList {
  return {
    strings: new Set<string>(
      skipList.filter((e) => typeof e === 'string') as string[]
    ),
    functions: skipList.filter((e) => typeof e === 'function') as SkipFn[],
    regexps: skipList.filter((e) => typeof e === 'object') as RegExp[],
  };
}

export function isInSkipList(
  entry: string,
  skipList: PreparedSkipList
): boolean {
  if (skipList.strings.has(entry)) {
    return true;
  }

  if (skipList.functions.find((f) => f(entry))) {
    return true;
  }

  if (skipList.regexps.find((r) => r.test(entry))) {
    return true;
  }

  return false;
}
