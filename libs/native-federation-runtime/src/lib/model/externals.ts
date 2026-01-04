import { SharedInfo } from './federation-info';
import { globalCache } from './global-cache';
// TODO: Uncomment when implementing Phase 3
import { satisfies, getHighestVersion } from '../utils/semver';

const externals = globalCache.externals;

/**
 * Registry entry for a shared module with semver support
 */
interface RegisteredShared {
  info: SharedInfo;
  url: string;
}

/**
 * Registry for semver-based sharing
 * Maps package name to array of registered versions
 * Example: 'foo' -> [{ info: { version: '18.0.0', ... }, url: 'http://...' }]
 */
const sharedRegistry = new Map<string, RegisteredShared[]>();

/**
 * Global flag for share config enforcement
 * When false: uses exact version matching (legacy behavior)
 * When true: uses semver matching with singleton/strictVersion enforcement
 */
let useShareConfig = false;

/**
 * Sets the global flag for share config enforcement
 *
 * Called from initFederation when useShareConfig option is provided.
 * This determines whether the runtime uses exact version matching (legacy)
 * or semver matching with config enforcement.
 *
 * @param enabled - Whether to enable share config enforcement
 */
export function setUseShareConfig(enabled: boolean): void {
  useShareConfig = enabled;
}

/**
 * Generates the exact-match key for a shared dependency
 *
 * This is used for the legacy behavior (exact version matching).
 * Format: "packageName@version"
 *
 * @param shared - Shared dependency info
 * @returns Key string in format "packageName@version"
 */
function getExternalKey(shared: SharedInfo) {
  return `${shared.packageName}@${shared.version}`;
}

/**
 * Helper to detect if a shared dependency has non-default config
 *
 * This is used to warn developers when they have config that won't be enforced
 * because useShareConfig is disabled.
 *
 * Non-default config includes:
 * - singleton: true (default is false)
 * - strictVersion: true (default is false)
 * - requiredVersion that's not '*' or 'false'
 *
 * @param shared - The shared dependency info
 * @returns true if any non-default config is present
 */
function hasNonDefaultConfig(shared: SharedInfo): boolean {
  // TODO: Check if singleton is true
  // TODO: Check if strictVersion is true
  // TODO: Check if requiredVersion is not '*' and not 'false'
  // TODO: Return true if any of above are true
  throw new Error('Not implemented');
}

/**
 * Find compatible shared module based on config (singleton, strictVersion, requiredVersion)
 *
 * This implements the following resolution algorithm.
 * Used when useShareConfig is enabled.
 *
 * Resolution steps:
 * 1. Try exact match first (fast path)
 * 2. If singleton mode:
 *    - Use first registered version (singleton)
 *    - Check version compatibility if requiredVersion specified
 *    - Handle strictVersion enforcement
 * 3. If non-singleton mode:
 *    - Find all compatible versions
 *    - Use highest compatible version
 *    - Handle strictVersion enforcement
 *
 * @param shared - The shared dependency being requested
 * @returns URL to the shared bundle, or undefined if no compatible version found (use own bundle)
 */
function findCompatibleShared(shared: SharedInfo): string | undefined {
  // TODO: Get registered versions for this package name
  // TODO: Return undefined if no versions registered

  // TODO: STEP 1 - Try exact match first (fast path)
  // TODO: If exact match found, return its URL

  // TODO: STEP 2 - Handle singleton mode
  // TODO: If singleton, get first registered version
  // TODO: If requiredVersion is 'false', skip version check and return singleton URL
  // TODO: Check if singleton version satisfies requiredVersion
  // TODO: If satisfied, return singleton URL
  // TODO: If not satisfied and strictVersion is true, warn and return undefined (use own bundle)
  // TODO: If not satisfied and strictVersion is false, warn and return singleton URL anyway

  // TODO: STEP 3 - Handle non-singleton mode
  // TODO: If requiredVersion is 'false', return highest available version
  // TODO: Find all versions that satisfy requiredVersion
  // TODO: If compatible versions found, return highest compatible version
  // TODO: If no compatible versions and strictVersion is true, warn and return undefined
  // TODO: If no compatible versions and strictVersion is false, warn and return highest version anyway

  // TODO: Return undefined if no suitable version found
  throw new Error('Not implemented');
}

/**
 * Gets the URL for a shared dependency
 *
 * This is the main entry point for shared dependency resolution.
 * Behavior depends on useShareConfig flag:
 *
 * Legacy mode (useShareConfig: false):
 * - Uses exact version matching only
 * - Returns URL only if exact version match exists
 *
 * Share config mode (useShareConfig: true):
 * - Uses semver range matching
 * - Enforces singleton, strictVersion, requiredVersion
 * - Follows Webpack Module Federation algorithm
 *
 * @param shared - The shared dependency info
 * @returns URL to the shared bundle, or undefined if not found/compatible
 */
export function getExternalUrl(shared: SharedInfo): string | undefined {
  // Legacy behavior: exact version matching only
  if (!useShareConfig) {
    const packageKey = getExternalKey(shared);
    return externals.get(packageKey);
  }

  // New behavior: use share config for smart matching
  // TODO: Call findCompatibleShared and return result
  throw new Error('Not implemented');
}

/**
 * Registers a shared dependency URL
 *
 * This is called when processing host and remote shared dependencies.
 * It maintains both:
 * 1. Legacy exact-match registry (for backwards compatibility)
 * 2. Semver-based registry (for share config mode)
 *
 * Singleton enforcement:
 * - In share config mode, if singleton is true and a version already exists,
 *   the new version is rejected (first registration wins)
 *
 * @param shared - The shared dependency info
 * @param url - The URL where this shared dependency can be loaded from
 */
export function setExternalUrl(shared: SharedInfo, url: string): void {
  // Always maintain legacy exact-match registry
  const packageKey = getExternalKey(shared);
  externals.set(packageKey, url);

  // TODO: Warn if useShareConfig is FALSE but sharing config is set
  // TODO: This helps developers know their config (singleton, strictVersion, requiredVersion) is ignored
  // TODO: Only warn if any config is non-default (singleton=true, strictVersion=true, or requiredVersion != '*')
  // TODO: Consider checking shared.dev to only warn in dev mode
  // TODO: Example:
  // TODO:   if (!useShareConfig && hasNonDefaultConfig(shared)) {
  // TODO:     if (shared.dev) { // Only warn in dev mode
  // TODO:       console.warn(
  // TODO:         `[Federation] Shared dependency "${shared.packageName}@${shared.version}" has ` +
  // TODO:         `sharing config (singleton=${shared.singleton}, strictVersion=${shared.strictVersion}, ` +
  // TODO:         `requiredVersion=${shared.requiredVersion}) but useShareConfig is disabled. ` +
  // TODO:         `Config will be ignored. Set useShareConfig: true in initFederation() to enforce it.`
  // TODO:       );
  // TODO:     }
  // TODO:   }

  // TODO: Get or create array for this package in sharedRegistry

  // TODO: If singleton is true and versions already registered (when useShareConfig is enabled):
  // TODO:   - Warn about ignored registration
  // TODO:   - Example: console.warn(
  // TODO:       `[Federation] Singleton "${shared.packageName}" already registered with version ` +
  // TODO:       `${existing[0].info.version}. Ignoring version ${shared.version}.`
  // TODO:     );
  // TODO:   - Return early (don't register duplicate singleton)

  // TODO: Add { info: shared, url } to sharedRegistry
}
