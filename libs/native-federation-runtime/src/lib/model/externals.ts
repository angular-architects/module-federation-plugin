import { SharedInfo } from "@angular-architects/native-federation";

const externals = new Map<string, string>();

function getExternalKey(shared: SharedInfo) {
    return `${shared.packageName}@${shared.version}`;
}

export function getExternalUrl(shared: SharedInfo): string | undefined {
    const packageKey = getExternalKey(shared);
    return externals.get(packageKey);
}

export function setExternalUrl(shared: SharedInfo, url: string): void {
    const packageKey = getExternalKey(shared);
    externals.set(packageKey, url);
}