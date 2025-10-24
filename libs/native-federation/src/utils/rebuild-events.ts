import { EventHub, EventSource } from './event-sorce';

export interface RebuildEvents {
  readonly rebuild: EventSource;
}

export class RebuildHubs implements RebuildEvents {
  readonly rebuild = new EventHub();
}
