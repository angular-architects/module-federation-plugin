import { EventHub, EventSource } from './event-source';

export interface RebuildEvents {
  readonly rebuild: EventSource;
}

export class RebuildHubs implements RebuildEvents {
  readonly rebuild = new EventHub();
}
