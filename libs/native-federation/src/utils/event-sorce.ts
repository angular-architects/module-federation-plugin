export type EventHandler = () => Promise<void>;

export interface EventSource {
  register(handler: EventHandler): void;
}

export class EventHub implements EventSource {
  private handlers: EventHandler[] = [];

  register(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  async emit(): Promise<void> {
    const promises = this.handlers.map((h) => h());
    await Promise.all(promises);
  }
}
