import { logger } from './logger';

interface BuildControl {
  controller: AbortController;
  buildFinished: { resolve: () => void; promise: Promise<void> };
}

export class RebuildQueue {
  private activeBuilds: Map<number, BuildControl> = new Map();
  private buildCounter = 0;

  async enqueue(
    rebuildFn: (signal: AbortSignal) => Promise<void>,
  ): Promise<void> {
    const buildId = ++this.buildCounter;

    const pendingCancellations = Array.from(this.activeBuilds.values()).map(
      (buildInfo) => {
        buildInfo.controller.abort();
        return buildInfo.buildFinished.promise;
      },
    );

    if (pendingCancellations.length > 0) {
      logger.info(`Aborting ${pendingCancellations.length} bundling task(s)..`);
    }

    if (pendingCancellations.length > 0) {
      await Promise.all(pendingCancellations);
    }

    let buildFinished: () => void;
    const completionPromise = new Promise<void>((resolve) => {
      buildFinished = resolve;
    });

    const control: BuildControl = {
      controller: new AbortController(),
      buildFinished: {
        resolve: buildFinished!,
        promise: completionPromise,
      },
    };
    this.activeBuilds.set(buildId, control);

    try {
      await rebuildFn(control.controller.signal);
    } finally {
      control.buildFinished.resolve();
      this.activeBuilds.delete(buildId);
    }
  }

  dispose(): void {
    for (const [_, buildInfo] of this.activeBuilds) {
      buildInfo.controller.abort();
    }
    this.activeBuilds.clear();
  }
}
