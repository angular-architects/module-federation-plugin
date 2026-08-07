// Stands in for a webpack-built ESM remote entry. `loadRemoteModuleEntry` does a
// dynamic `import()` of the remoteEntry string, which the spec transform turns
// into a `require()` — so pointing remoteEntry at this file's absolute path
// exercises the real code path instead of mocking it away.

const calls = { init: [], get: [] };

exports.calls = calls;

exports.init = (shareScope) => {
  calls.init.push(shareScope);
};

exports.get = (exposedModule) => {
  calls.get.push(exposedModule);
  return () => ({ loadedFrom: 'esm-remote-entry', exposedModule });
};
