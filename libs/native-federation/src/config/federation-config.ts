import { MappedPath } from "../utils/mapped-paths";

export interface SharedConfig {
    singleton?: boolean;
    strictVersion?: boolean;
    requiredVersion?: string;
    version?: string;
}

export interface FederationConfig {
    name?: string;
    exposes?: Record<string, string>;
    shared?: Record<string, SharedConfig>;
    sharedMappings?: Array<string>;
    skip?: Array<string>;
}

export interface NormalizedSharedConfig {
    singleton: boolean;
    strictVersion: boolean;
    requiredVersion: string;
    version?: string;
}

export interface NormalizedFederationConfig {
    name: string;
    exposes: Record<string, string>;
    shared: Record<string, NormalizedSharedConfig>;
    sharedMappings: Array<MappedPath>;
}
