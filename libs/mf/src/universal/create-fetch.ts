// import { AbortablePromise } from 'jsdom';
import { promises } from 'fs';
import { normalize } from 'path';

import fetch from 'node-fetch';

export type AbortablePromise<T> = Promise<T> & {
  abort: () => unknown;
};

export type StringDict = { [key: string]: string };

export function createFetch(mappings: StringDict = {}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function (url: string, options: unknown) {
    if (!url.endsWith('.js')) {
      return null;
    }

    let path = url.replace(this.baseUrl, this.publicPath);

    for (const prefix in mappings) {
      if (path.startsWith(prefix)) {
        path = path.replace(prefix, mappings[prefix]);
      }
    }

    if (this.fileCache.has(path)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const filePromise = Promise.resolve(
        this.fileCache.get(path)!
      ) as AbortablePromise<Buffer>;
      filePromise.abort = () => undefined;
      return filePromise;
    }

    let read: Promise<Buffer | string>;

    if (path.match(/^http(s)?:\/\//i)) {
      // console.log('http', path);
      read = fetch(path).then((res) => res.text());
    } else {
      path = normalize(path);
      // console.log('file', path);
      read = promises.readFile(path);
    }

    const promise = read.then((content) => {
      this.fileCache.set(path, content);

      return content;
    }) as AbortablePromise<Buffer>;

    promise.abort = () => undefined;

    return promise;
  };
}
