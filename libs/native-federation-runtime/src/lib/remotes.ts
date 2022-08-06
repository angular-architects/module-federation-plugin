const remotes = new Map<string, string>();

export function setRemoteBaseUrl(remoteName: string, url: string): void {
    remotes.set(remoteName, url);
}

export function getRemoteBaseUrl(remoteName: string): string | undefined {
    return remotes.get(remoteName);
}
