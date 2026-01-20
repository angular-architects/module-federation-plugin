import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';

type TryCreateTrustedScript = (string: string) => string | TrustedScript;

describe('tryCreateTrustedScript', () => {
  let tryCreateTrustedScript: TryCreateTrustedScript | undefined;

  beforeEach(async () => {
    // Setup
    vi.resetModules();
    const mod = await import('./trusted-types');
    tryCreateTrustedScript = mod.tryCreateTrustedScript;
  });

  afterEach(() => {
    // Clean up
    delete (globalThis as any).trustedTypes;
    vi.resetModules();
  });

  it('returns input when trustedTypes is undefined', () => {
    // Setup
    (globalThis as any).trustedTypes = undefined;
    const input = 'alert(1)';

    // Execute
    const result = tryCreateTrustedScript!(input);

    // Assert
    expectTypeOf(result as string).toExtend<string>();
    expect(result).toBe(input);
  });

  it('returns input when trustedTypes is defined', () => {
    // Setup
    const input = 'alert(1)';

    // Execute
    const result = tryCreateTrustedScript!(input);

    // Assert
    expectTypeOf(result as TrustedScript).toExtend<TrustedScript>();
    expect(result).toBe(input);
  });

  it('caches policy and only calls createPolicy once', () => {
    // Setup
    let createPolicyMock = vi.fn(() => ({
      createScript: (s: string) => `CACHE:${s}`,
      createHTML: (h: string) => h,
      createScriptURL: (u: string) => u,
    }));

    (globalThis as any).trustedTypes = {
      createPolicy: createPolicyMock,
    };

    // Execute
    const result1 = tryCreateTrustedScript!('a=1');
    const result2 = tryCreateTrustedScript!('b=2');

    // Assert
    expect(result1).toBe(`CACHE:a=1`);
    expect(result2).toBe(`CACHE:b=2`);
    expect(createPolicyMock).toHaveBeenCalledTimes(1);
  });

  it('falls back when createPolicy throws', () => {
    // Setup
    const createPolicyMock = vi.fn(() => {
      throw new Error('policy exists');
    });

    (globalThis as any).trustedTypes = {
      createPolicy: createPolicyMock,
    };

    const input = 'console.log("fallback")';
    // Execute
    const result = tryCreateTrustedScript!(input);

    // Assert
    expect(typeof result).toBe('string');
    expect(result).toBe(input);
    expect(createPolicyMock).toHaveBeenCalled();
  });
});
