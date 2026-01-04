export type SharedInfo = {
  /**
   * Ensures only ONE instance of the library exists across all federated modules.
   * Enforced when useShareConfig is enabled.
   */
  singleton: boolean;

  /**
   * Controls whether to reject incompatible versions or just warn.
   * Enforced when useShareConfig is enabled.
   */
  strictVersion: boolean;

  /**
   * Specifies acceptable version range using semver (e.g., '^3.0.0', '>=3.0.0 <5.0.0').
   * Can be 'false' to disable version checking.
   * Enforced when useShareConfig is enabled.
   */
  requiredVersion: string;

  /**
   * The version being provided by this module.
   */
  version?: string;

  /**
   * The package name (e.g. '@angular/core').
   */
  packageName: string;

  /**
   * The output filename for the shared bundle.
   */
  outFileName: string;

  /**
   * Development mode configuration.
   */
  dev?: {
    entryPoint: string;
  };
};

export interface ExposesInfo {
  key: string;
  outFileName: string;
  dev?: {
    entryPoint: string;
  };
}

export interface FederationInfo {
  name: string;
  exposes: ExposesInfo[];
  shared: SharedInfo[];
  buildNotificationsEndpoint?: string;
}

export interface InitFederationOptions {
  cacheTag?: string;

  /**
   * Enables enforcement of shared dependency configuration at runtime
   *
   * When false (default):
   * - Uses exact version matching only (current behavior)
   * - singleton, strictVersion, requiredVersion are metadata-only
   *
   * When true:
   * - Enforces singleton, strictVersion, requiredVersion at runtime
   * - Uses semver range matching (^, ~, >=, etc.)
   * - Provides warnings/errors for version mismatches
   *
   * @default false
   * @since 3.6.0
   */
  useShareConfig?: boolean;
}

export interface ProcessRemoteInfoOptions extends InitFederationOptions {
  throwIfRemoteNotFound: boolean;
}
