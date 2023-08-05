import { MappedPath } from '../utils/mapped-paths';
export type BuildKind = 'shared-package' | 'shared-mapping' | 'exposed';
export interface BuildAdapterOptions {
    entryPoint: string;
    tsConfigPath?: string;
    external: Array<string>;
    outfile: string;
    mappedPaths: MappedPath[];
    packageName?: string;
    esm?: boolean;
    dev?: boolean;
    watch?: boolean;
    kind: BuildKind;
}
export type BuildAdapter = (options: BuildAdapterOptions) => Promise<void>;
export declare function setBuildAdapter(buildAdapter: BuildAdapter): void;
export declare function getBuildAdapter(): BuildAdapter;
