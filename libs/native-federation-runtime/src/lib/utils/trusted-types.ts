import { TrustedTypePolicy, TrustedTypePolicyFactory } from 'trusted-types';

const global: any = globalThis;

let policy: TrustedTypePolicy | null | undefined;

function createPolicy(): TrustedTypePolicy | null {
  if (policy === undefined) {
    policy = null;
    if (global.trustedTypes) {
      try {
        policy = (global.trustedTypes as TrustedTypePolicyFactory).createPolicy(
          'native-federation',
          {
            createHTML: (html: string) => html,
            createScript: (script: string) => script,
            createScriptURL: (url: string) => url,
          },
        );
      } catch {
        // trustedTypes.createPolicy may throw an exception if called with a name that is already registered, even in report-only mode.
      }
    }
  }
  return policy;
}

export function tryCreateTrustedScript(script: string): string | TrustedScript {
  return createPolicy()?.createScript(script) ?? script;
}
