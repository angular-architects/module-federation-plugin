import { InitFederationOptions } from "../model/federation-info";

export function setOptions(overrides: Partial<InitFederationOptions>|undefined) {
    return {
        hostRemoteEntry: "./remoteEntry.json",
        throwIfRemoteNotFound: false,
        ...overrides
    } as InitFederationOptions;
}