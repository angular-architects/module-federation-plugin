// based on https://github.com/apollographql/graphql-subscriptions/blob/master/src/event-emitter-to-async-iterator.ts

import { Observable, Observer } from 'rxjs';

export function observableToAsyncIterable<T>(
  observable: Observable<T>
): AsyncIterable<T> {
  const pullQueue: any[] = [];
  const pushQueue: any[] = [];
  let listening = true;

  const pushValue = (value: T | undefined, done: boolean) => {
    if (pullQueue.length !== 0) {
      const resolve = pullQueue.shift();
      if (resolve) {
        resolve({ value, done });
      }
    } else {
      pushQueue.push(value);
    }
  };

  const pullValue = () => {
    return new Promise((resolve) => {
      if (pushQueue.length !== 0) {
        resolve({ value: pushQueue.shift(), done: false });
      } else {
        pullQueue.push(resolve);
      }
    });
  };

  const emptyQueue = () => {
    if (listening) {
      listening = false;
      pullQueue.forEach((resolve) => resolve({ value: undefined, done: true }));
      pullQueue.length = 0;
      pushQueue.length = 0;
    }
  };

  const observer: Observer<T> = {
    next(value) {
      pushValue(value, this.closed);
    },

    error(e) {
      this.closed = true;
      pushValue(e, this.closed);
    },

    complete() {
      this.closed = true;
      pushValue(undefined, this.closed);
    },
  };

  const subscription = observable.subscribe(observer);

  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (!listening) {
            return this.return();
          }
          const value = await pullValue();
          return value;
        },
        return() {
          emptyQueue();
          subscription.unsubscribe();
          return Promise.resolve({
            value: {},
            done: true,
          } as IteratorResult<T>);
        },
        throw(error) {
          emptyQueue();
          subscription.unsubscribe();
          return Promise.reject(error);
        },
      };
    },
  };
}
