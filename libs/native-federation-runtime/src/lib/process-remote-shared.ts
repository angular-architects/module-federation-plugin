import { Imports } from './model/import-map';
import { SharedInfo } from './model/federation-info';
import { satisfies, coerce, parse } from 'semver';
import { getHostInfoOrThrow } from './init-federation-cache';

/**
 * Processes a remote shared module and determines if the host's version can be used,
 * updating the import scope accordingly.
 *
 * This function resolves shared module dependencies between the host and a remote module.
 * It checks whether the host's version of a shared module can be used by the remote,
 * considering singleton mode and version compatibility.
 *
 * **Singleton Mode**:
 * - When `singleton` is `true`, the remote expects only one instance of the module in the application.
 * - If the host does not share the module, the remote cannot use the host's version.
 * - If both host and remote have version information:
 *   - The host's version must satisfy the remote's `requiredVersion` (checked via `semver.satisfies`).
 *   - If compatible, the host's version is used.
 *   - If incompatible, an error is thrown since singleton mode requires a single compatible version.
 * - If neither host nor remote have version information (e.g., for shared mappings), the host's version is used.
 *
 * **Non-Singleton Mode**:
 * - If the host does not share the module, the remote must provide its own version.
 * - If both host and remote have version information:
 *   - If the host's version satisfies the remote's `requiredVersion`, the host's version is used.
 *   - If not, the remote must provide its own version.
 * - If neither host nor remote have version information, the host's version is used.
 *
 * **Version Compatibility**:
 * - The `requiredVersion` specifies the version range the remote expects for the shared module.
 * - Version compatibility is checked using semantic versioning (`semver.satisfies`).
 *
 *
 * Note: In this implementation, **strictVersion** is not used (or considered true). Therefore, the function
 * will use the host's version of a package if it satisfies the remote's required version, regardless of
 * whether the host's version is an exact match. This is because a well-written **requiredVersion** range expression
 * handles all version constraints' cases.
 *
 * @param {Imports} scope - The import map to be updated with the resolved module paths.
 * @param {SharedInfo} remoteShared - The shared module information from the remote container.
 * @param {string} [relHostBundlesPath='./'] - The relative path to the host's bundle directory.
 *
 * @throws {Error} If the host's version is incompatible with the remote's required version in singleton mode.
 */
export function processRemoteShared(
  scope: Imports,
  remoteShared: SharedInfo,
  relHostBundlesPath = './'
) {
  const hostInfo = getHostInfoOrThrow();

  const packageName = remoteShared.packageName;
  const hostShared = hostInfo.shared.find((s) => s.packageName === packageName);

  // Check if the remote requires a singleton instance of the package
  if (remoteShared.singleton) {
    // If the host does not share the package, we cannot use it
    if (!hostShared) return;

    if (!hostShared.version && !remoteShared.version) {
      // The host and remote do not have version info, they are sharedMappings
      scope[packageName] = relHostBundlesPath + hostShared.outFileName;
      return;
    }

    if (hostShared.version && remoteShared.version) {
      if (satisfiesWithPrerelease(hostShared.version, remoteShared.requiredVersion)) {
        // Use the host's version of the package
        scope[packageName] = relHostBundlesPath + hostShared.outFileName;
        return;
      }
    }

    // The host's version is incompatible with the remote's requirements in singleton mode
    throw new Error(
      `Host has version ${hostShared.version} of ${packageName} but remote requires ${remoteShared.requiredVersion} and we are in singleton mode`
    );
  }

  // If the host does not share the package and singleton is false, there's nothing to do
  if (!hostShared) return;

  // Determine if the host's version of the package can be used
  if (
    (!hostShared.version && !remoteShared.version) || // Neither host nor remote has version info, it is a shared mapping
    (hostShared.version &&
      remoteShared.version &&
      satisfiesWithPrerelease(hostShared.version, remoteShared.requiredVersion)) // Host's version is compatible
  ) {
    // Use the host's version of the package
    scope[packageName] = relHostBundlesPath + hostShared.outFileName;
  }
}

function satisfiesWithPrerelease(version: string, requiredVersion: string) {
  const parsed = parse(version);
  if (!parsed) throw new Error(`Invalid version: ${version}`);

  return satisfies(parsed.version, requiredVersion);
}
