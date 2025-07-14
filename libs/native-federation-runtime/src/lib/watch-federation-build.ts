import { BuildNotificationType } from './model/build-notifications-options';

/**
 * Watches for federation build completion events and automatically reloads the page.
 *
 * This function establishes a Server-Sent Events (SSE) connection to listen for
 * 'federation-rebuild-complete' notifications. When a build completes successfully,
 * it triggers a page reload to reflect the latest changes.
 * @param endpoint - The SSE endpoint URL to watch for build notifications.
 */
export function watchFederationBuildCompletion(endpoint: string) {
  const eventSource = new EventSource(endpoint);

  eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    if (data.type === BuildNotificationType.COMPLETED) {
      console.log('[Federation] Rebuild completed, reloading...');
      window.location.reload();
    }
  };

  eventSource.onerror = function (event) {
    console.warn('[Federation] SSE connection error:', event);
  };
}
