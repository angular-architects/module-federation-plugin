import { EventHub, EventSource } from './event-sorce';

export interface RebuildEvents {
  readonly rebuildMappings: EventSource;
  readonly rebuildExposed: EventSource;
}

export class RebuildHubs implements RebuildEvents {
  readonly rebuildMappings = new EventHub();
  readonly rebuildExposed = new EventHub();
}
