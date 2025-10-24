import { SharedObject } from '@module-federation/enhanced/dist/src/declarations/plugins/sharing/SharePlugin';

export type CheckSkipFn = (packageName: string) => boolean;
export type SkipListItem = string | RegExp | CheckSkipFn;
export type SkipList = SkipListItem[];
export type NormalizedSkipList = CheckSkipFn[];

export function normalizeSkipList(skipList: SkipList = []): NormalizedSkipList {
  return skipList.map((item) => {
    if (typeof item === 'string') {
      return (p) => item === p;
    } else if (item instanceof RegExp) {
      return (p) => item.test(p);
    } else {
      return item;
    }
  });
}

export function applySkipList(
  normalizedSkip: NormalizedSkipList,
  shared: SharedObject
) {
  const filtered: SharedObject = {};
  for (const key in shared) {
    if (!normalizedSkip.find((f) => f(key))) {
      filtered[key] = shared[key];
    }
  }
  return filtered;
}
