export const packageNamespace = '@angular-architects/module-federation-tools';

function getGlobalState<T>(): T {
    const globalState = (window as unknown as { [packageNamespace]: T });
    globalState[packageNamespace] = globalState[packageNamespace] || ({} as unknown as T);
    return globalState[packageNamespace];
}

export function getGlobalStateSlice<T>(): T;
export function getGlobalStateSlice<T, R>(selector: (globalState: T) => R): R;
export function getGlobalStateSlice<T, R>(
    selector?: (globalState: T) => R
): R | T {
    const globalState = getGlobalState<T>();
    return selector ? selector(globalState) : globalState;
}

export function setGlobalStateSlice<T>(slice: T): T {
    return Object.assign(
        getGlobalState<T>(),
        slice
    );
}
