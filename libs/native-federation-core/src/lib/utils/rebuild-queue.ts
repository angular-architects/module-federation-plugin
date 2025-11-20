import { logger } from './logger';

export class RebuildQueue {
  private activeBuilds: Map<number, AbortController> = new Map();
  private buildCounter = 0;

  async enqueue(rebuildFn: () => Promise<void>): Promise<void> {
    const buildId = ++this.buildCounter;

    for (const [_, controller] of this.activeBuilds) {
      controller.abort();
    }
    if (this.activeBuildCount > 0)
      logger.info(`Aborted ${this.activeBuildCount} previous bundling task(s)`);

    this.activeBuilds.clear();

    const controller = new AbortController();
    this.activeBuilds.set(buildId, controller);

    try {
      await rebuildFn();
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
