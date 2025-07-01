import { BUILD_NOTIFICATIONS_ENDPOINT, BuildNotificationType } from './consts';

/**
 * Watches for federation build completion events and automatically reloads the page.
 *
 * This function establishes a Server-Sent Events (SSE) connection to listen for
 * 'federation-rebuild-complete' notifications. When a build completes successfully,
 * it triggers a page reload to reflect the latest changes.
 *
 * **Use Cases:**
 *
 * 1. **Standalone MFE Development**: Place in main.ts of a microfrontend to auto-reload
 *    when its own federation artifacts are rebuilt.
 *    ```typescript
 *    // main.ts (MFE running on port 4201)
 *    if (!environment.production) {
 *      watchFederationBuildCompletion(); // Uses default endpoint
 *    }
 *    ```
 *
 * 2. **Shell watching MFE changes**: Place in shell's main.ts to reload when a
 *    remote MFE is rebuilt during development.
 *    ```typescript
 *    import { BUILD_NOTIFICATIONS_ENDPOINT } from '@softarc/native-federation';
 *
 *    // main.ts (Shell on port 4200, watching MFE on port 4201)
 *    if (!environment.production) {
 *      // Option A: Using the imported constant (recommended)
 *      watchFederationBuildCompletion(`http://localhost:4201${BUILD_NOTIFICATIONS_ENDPOINT}`);
 *
 *      // Option B: Hardcoded URL
 *      watchFederationBuildCompletion('http://localhost:4201/@angular-architects/native-federation:build-notifications');
 *    }
 *    ```
 *
 * **Requirements:**
 * - Only works during development when `buildNotifications.enable: true` is set in angular.json
 * - The target application must be running with the native-federation dev server
 * - Should only be called in development mode, never in production
 *
 * **Available Constants:**
 * You can import `BUILD_NOTIFICATIONS_ENDPOINT` to avoid hardcoding the endpoint path:
 * ```typescript
 * import { BUILD_NOTIFICATIONS_ENDPOINT } from '@angular-architects/native-federation';
 * ```
 *
 * @param customEndpoint - Optional custom SSE endpoint URL. If not provided, uses the
 *                        default endpoint on the same port as the current application.
 *                        Use this when watching builds from a different port/host.
 *                        For cross-port scenarios, you can interpolate the endpoint:
 *                        `http://localhost:PORT${BUILD_NOTIFICATIONS_ENDPOINT}`
 *
 * @example
 * ```typescript
 * // In main.ts for development hot-reload
 * if (!environment.production) {
 *   watchFederationBuildCompletion();
 * }
 * ```
 */
export function watchFederationBuildCompletion(customEndpoint?: string) {
  const eventSource = new EventSource(
    customEndpoint || BUILD_NOTIFICATIONS_ENDPOINT
  );

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
