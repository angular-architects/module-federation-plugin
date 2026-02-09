import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuildNotificationType } from './model/build-notifications-options';
import { watchFederationBuildCompletion } from './watch-federation-build';

describe('watch-federation-build', () => {
  let fakeReload: ReturnType<typeof vi.fn>;
  let mockConsoleLog: any;
  let mockConsoleWarn: any;
  let eventSourceInstance: any;

  beforeEach(() => {
    fakeReload = vi.fn();
    vi.stubGlobal('window', { location: { reload: fakeReload } });

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    eventSourceInstance = {
      onmessage: null,
      onerror: null,
    };

    // Create a proper constructor function for EventSource
    const EventSourceMock = vi.fn(function (this: any) {
      return eventSourceInstance;
    });

    vi.stubGlobal('EventSource', EventSourceMock);
  });

  describe('watchFederationBuildCompletion', () => {
    it('reloads page when build completion is received', () => {
      watchFederationBuildCompletion(
        'http://localhost:4200/build-notifications',
      );

      eventSourceInstance.onmessage({
        data: JSON.stringify({ type: BuildNotificationType.COMPLETED }),
      });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '[Federation] Rebuild completed, reloading...',
      );
      expect(fakeReload).toHaveBeenCalled();
    });

    it('does not reload page for non-completion messages', () => {
      watchFederationBuildCompletion(
        'http://localhost:4200/build-notifications',
      );

      eventSourceInstance.onmessage({
        data: JSON.stringify({ type: BuildNotificationType.ERROR }),
      });

      expect(fakeReload).not.toHaveBeenCalled();
    });

    it('logs warning on SSE connection error', () => {
      watchFederationBuildCompletion(
        'http://localhost:4200/build-notifications',
      );

      const errorEvent = {};
      eventSourceInstance.onerror(errorEvent);

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        '[Federation] SSE connection error:',
        errorEvent,
      );
    });
  });
});
