import { BuildNotificationType } from '@softarc/native-federation-runtime';
import { logger } from '@softarc/native-federation/build';
import { IncomingMessage, ServerResponse } from 'http';

// =============================================================================
// SSE Event Management for Local Development Hot Reload
// =============================================================================

interface SSEConnection {
  response: ServerResponse;
  request: IncomingMessage;
}

interface FederationEvent {
  type: string;
  timestamp?: number;
  error?: string;
  [key: string]: unknown;
}

type NextFunction = (error?: Error) => void;
type MiddlewareFunction = (
  req: IncomingMessage,
  res: ServerResponse,
  next: NextFunction,
) => void;

/**
 * Manages Server-Sent Events for federation hot reload in local development
 * Only active when running in development mode with dev server
 */
export class FederationBuildNotifier {
  private connections: SSEConnection[] = [];
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isActive = false;
  private endpoint: string;

  /**
   * Initializes the SSE reloader for local development
   */
  public initialize(endpoint: string): void {
    if (this.isActive) {
      return;
    }

    this.endpoint = endpoint;
    this.isActive = true;
    this.startCleanup();

    logger.info(
      `[Federation SSE] Local reloader initialized with endpoint ${this.endpoint}`,
    );
  }

  /**
   * Creates SSE middleware for federation events
   */
  public createEventMiddleware(
    removeBaseHref: (req: IncomingMessage) => string,
  ): MiddlewareFunction {
    if (!this.isActive) {
      return (req: IncomingMessage, res: ServerResponse, next: NextFunction) =>
        next();
    }

    return (req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
      const url = removeBaseHref(req);

      if (url !== this.endpoint) {
        return next();
      }

      this._setupSSEConnection(req, res);
    };
  }

  /**
   * Sets up a new SSE connection
   */
  private _setupSSEConnection(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial connection event
    this._sendEvent(res, {
      type: 'connected',
      timestamp: Date.now(),
    });

    // Store connection
    const connection: SSEConnection = { response: res, request: req };
    this.connections.push(connection);

    // Handle disconnection
    req.on('close', () => this._removeConnection(connection));
    req.on('error', () => this._removeConnection(connection));

    logger.info(
      `[Federation SSE] Client connected. Active connections: ${this.connections.length}`,
    );
  }

  /**
   * Removes a connection from the pool
   */
  private _removeConnection(connection: SSEConnection): void {
    const index = this.connections.indexOf(connection);
    if (index !== -1) {
      this.connections.splice(index, 1);
      logger.info(
        `[Federation SSE] Client disconnected. Active connections: ${this.connections.length}`,
      );
    }
  }

  /**
   * Broadcasts an event to all connected clients
   * Only works in local development mode
   */
  private _broadcastEvent(event: FederationEvent): void {
    if (!this.isActive || this.connections.length === 0) {
      return;
    }

    const deadConnections: SSEConnection[] = [];

    this.connections.forEach((connection) => {
      try {
        this._sendEvent(connection.response, event);
      } catch (error) {
        deadConnections.push(connection);
      }
    });

    // Remove dead connections
    deadConnections.forEach((connection) => this._removeConnection(connection));

    if (this.connections.length > 0) {
      logger.info(
        `[Federation SSE] Event '${event.type}' broadcast to ${this.connections.length} clients`,
      );
    }
  }

  /**
   * Sends an event to a specific response stream
   */
  private _sendEvent(res: ServerResponse, event: FederationEvent): void {
    const data = JSON.stringify(event);
    res.write(`data: ${data}\n\n`);
  }

  /**
   * Starts periodic cleanup of dead connections
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      const aliveBefore = this.connections.length;
      this.connections = this.connections.filter(
        (connection) =>
          !connection.response.destroyed &&
          !connection.request.destroyed &&
          connection.response.writable,
      );

      if (this.connections.length !== aliveBefore) {
        logger.info(
          `[Federation SSE] Cleaned up ${
            aliveBefore - this.connections.length
          } dead connections`,
        );
      }
    }, 30000); // Clean every 30 seconds
  }

  /**
   * Notifies about successful federation rebuild
   */
  public broadcastBuildCompletion(): void {
    this._broadcastEvent({
      type: BuildNotificationType.COMPLETED,
      timestamp: Date.now(),
    });
  }

  /**
   * Notifies about cancellation of a federation rebuild
   */
  public broadcastBuildCancellation(): void {
    this._broadcastEvent({
      type: BuildNotificationType.CANCELLED,
      timestamp: Date.now(),
    });
  }

  /**
   * Notifies about failed federation rebuild
   */
  public broadcastBuildError(error: unknown): void {
    this._broadcastEvent({
      type: BuildNotificationType.ERROR,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  /**
   * Stops cleanup and closes all connections
   * Should be called when development server stops
   */
  public stopEventServer(): void {
    if (!this.isActive) {
      return;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.connections.forEach((connection) => {
      try {
        connection.response.end();
      } catch (error) {
        // Connection might already be closed
      }
    });

    this.connections = [];
    this.isActive = false;
    logger.info('[Federation SSE] Local reloader disposed');
  }

  /**
   * Returns the number of active connections
   */
  public get activeConnections(): number {
    return this.connections.length;
  }

  /**
   * Returns whether the reloader is active
   */
  public get isRunning(): boolean {
    return this.isActive;
  }
}

// Singleton instance for local development
export const federationBuildNotifier = new FederationBuildNotifier();
