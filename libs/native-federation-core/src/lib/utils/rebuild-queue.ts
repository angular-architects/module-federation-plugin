export class RebuildQueue {
  private activeBuilds: Map<number, AbortController> = new Map();
  private buildCounter = 0;

  async enqueue(rebuildFn: () => Promise<void>): Promise<void> {
    const buildId = ++this.buildCounter;

    for (const [id, controller] of this.activeBuilds) {
      controller.abort();
    }
    this.activeBuilds.clear();

    const controller = new AbortController();
    this.activeBuilds.set(buildId, controller);

    try {
      await rebuildFn();
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`Build ${buildId} cancelled`);
      } else {
        throw error;
      }
    } finally {
      this.activeBuilds.delete(buildId);
    }
  }

  abort(): void {
    for (const [_, controller] of this.activeBuilds) {
      controller.abort();
    }
    this.activeBuilds.clear();
  }

  get signal(): AbortSignal | undefined {
    if (this.activeBuilds.size === 0) return undefined;

    const latestBuildId = Math.max(...this.activeBuilds.keys());
    return this.activeBuilds.get(latestBuildId)?.signal;
  }

  get activeBuildCount(): number {
    return this.activeBuilds.size;
  }
}
