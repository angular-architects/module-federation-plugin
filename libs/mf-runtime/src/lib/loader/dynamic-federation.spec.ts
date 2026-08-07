import { join } from 'path';

type DynamicFederation = typeof import('./dynamic-federation');

// The module keeps `config`, `containerMap` and the share-scope flag in module
// scope, so every test needs a freshly required copy.
let df: DynamicFederation;

const globalRef = globalThis as unknown as Record<string, unknown>;

// Absolute path so the `import()` inside loadRemoteModuleEntry resolves it.
const ESM_REMOTE_ENTRY = join(__dirname, '__fixtures__/esm-remote-entry.js');

type ScriptContainer = {
  init: jest.Mock;
  get: jest.Mock;
};

function createScriptContainer(): ScriptContainer {
  return {
    init: jest.fn(),
    get: jest.fn((exposedModule: string) => () => ({
      loadedFrom: 'script-remote-entry',
      exposedModule,
    })),
  };
}

// A real remote entry script registers `window[remoteName]` as a side effect of
// executing; jsdom never fetches the src, so we do it on appendChild and then
// fire onload by hand.
function stubScriptLoading(containers: Record<string, ScriptContainer>): {
  srcs: string[];
} {
  const srcs: string[] = [];

  jest
    .spyOn(document.body, 'appendChild')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockImplementation((node: any) => {
      srcs.push(node.src);
      Object.assign(globalRef, containers);
      node.onload();
      return node;
    });

  return { srcs };
}

beforeEach(async () => {
  jest.resetModules();
  jest.restoreAllMocks();

  globalRef['__webpack_init_sharing__'] = jest
    .fn()
    .mockResolvedValue(undefined);
  globalRef['__webpack_share_scopes__'] = { default: { fakeScope: true } };

  df = await import('./dynamic-federation');
});

describe('loadRemoteModule via a manifest', () => {
  it('loads a remote declared as type "module"', async () => {
    await df.initFederation(
      { mfe1: { type: 'module', remoteEntry: ESM_REMOTE_ENTRY } },
      true,
    );

    const module = await df.loadRemoteModule({
      type: 'manifest',
      remoteName: 'mfe1',
      exposedModule: './Component',
    });

    expect(module).toEqual({
      loadedFrom: 'esm-remote-entry',
      exposedModule: './Component',
    });
  });

  it('loads a remote declared as type "script"', async () => {
    const container = createScriptContainer();
    const { srcs } = stubScriptLoading({ mfe2: container });

    await df.initFederation(
      {
        mfe2: {
          type: 'script',
          remoteEntry: 'http://localhost:4201/remoteEntry.js',
        },
      },
      true,
    );

    const module = await df.loadRemoteModule({
      type: 'manifest',
      remoteName: 'mfe2',
      exposedModule: './Component',
    });

    expect(srcs).toEqual(['http://localhost:4201/remoteEntry.js']);
    expect(container.init).toHaveBeenCalledWith({ fakeScope: true });
    expect(module).toEqual({
      loadedFrom: 'script-remote-entry',
      exposedModule: './Component',
    });
  });

  it('defaults an entry with no type to "module"', async () => {
    // parseConfig fills in `type: 'module'` for both shorthand strings and
    // objects that omit it.
    await df.initFederation({ mfe1: ESM_REMOTE_ENTRY }, true);

    expect(df.getManifest()).toEqual({
      mfe1: { type: 'module', remoteEntry: ESM_REMOTE_ENTRY },
    });

    await expect(
      df.loadRemoteModule({
        type: 'manifest',
        remoteName: 'mfe1',
        exposedModule: './Component',
      }),
    ).resolves.toBeDefined();
  });

  it('supports the legacy two-string overload', async () => {
    await df.initFederation(
      { mfe1: { type: 'module', remoteEntry: ESM_REMOTE_ENTRY } },
      true,
    );

    const module = await df.loadRemoteModule('mfe1', './Component');

    expect(module).toEqual({
      loadedFrom: 'esm-remote-entry',
      exposedModule: './Component',
    });
  });

  it('throws when the remote is not in the manifest', async () => {
    await df.initFederation(
      { mfe1: { type: 'module', remoteEntry: ESM_REMOTE_ENTRY } },
      true,
    );

    await expect(
      df.loadRemoteModule('unknown-mfe', './Component'),
    ).rejects.toThrow('Manifest does not contain unknown-mfe');
  });

  it('throws a diagnostic naming the remote and the bad type', async () => {
    // The manifest is fetched at runtime and never validated, so a typo like
    // this reaches loadRemoteModule intact.
    await df.initFederation(
      { mfe1: { type: 'esm', remoteEntry: ESM_REMOTE_ENTRY } } as never,
      true,
    );

    await expect(df.loadRemoteModule('mfe1', './Component')).rejects.toThrow(
      'Unsupported type "esm" for remote "mfe1" - expected "module" or "script"',
    );
  });
});

describe('loadRemoteModule without a manifest', () => {
  it('treats options with no type as a script remote', async () => {
    const container = createScriptContainer();
    const { srcs } = stubScriptLoading({ mfe2: container });

    const module = await df.loadRemoteModule({
      remoteName: 'mfe2',
      remoteEntry: 'http://localhost:4201/remoteEntry.js',
      exposedModule: './Component',
    });

    expect(srcs).toEqual(['http://localhost:4201/remoteEntry.js']);
    expect(module).toEqual({
      loadedFrom: 'script-remote-entry',
      exposedModule: './Component',
    });
  });

  it('skips loading the remote entry when none is given', async () => {
    const container = createScriptContainer();
    const { srcs } = stubScriptLoading({ mfe2: container });

    // The entry was already pulled in by an earlier loadRemoteEntry call.
    await df.loadRemoteEntry('http://localhost:4201/remoteEntry.js', 'mfe2');
    expect(srcs).toEqual(['http://localhost:4201/remoteEntry.js']);

    const module = await df.loadRemoteModule({
      remoteName: 'mfe2',
      exposedModule: './Component',
    });

    expect(srcs).toHaveLength(1);
    expect(module).toEqual({
      loadedFrom: 'script-remote-entry',
      exposedModule: './Component',
    });
  });
});

describe('loadRemoteEntry', () => {
  it('throws when the legacy overload is called without a remoteName', async () => {
    await expect(
      (df.loadRemoteEntry as unknown as (remoteEntry: string) => Promise<void>)(
        'http://localhost:4201/remoteEntry.js',
      ),
    ).rejects.toThrow(
      'No remoteName passed for remote entry "http://localhost:4201/remoteEntry.js"',
    );
  });
});
