import http from 'node:http';
import net from 'node:net';

/**
 * Simple HTTP server for testing purposes
 */
export class TestServer {
  private server: http.Server;
  private port: number = 0;
  private routes: Map<string, (req: http.IncomingMessage, res: http.ServerResponse) => void>;

  /**
   * Create a new test server
   * @param routes - Map of path to handler functions
   */
  constructor(routes?: Map<string, (req: http.IncomingMessage, res: http.ServerResponse) => void>) {
    this.routes = routes || new Map();
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = req.url || '/';
    const handler = this.routes.get(url);

    if (handler) {
      handler(req, res);
    } else {
      // Default response if no route is found
      res.statusCode = 404;
      res.end('Not Found');
    }
  }

  /**
   * Start the server
   * @returns Promise that resolves when server is listening
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(0, () => {
        const address = this.server.address() as net.AddressInfo;
        this.port = address.port;
        resolve();
      });
    });
  }

  /**
   * Stop the server
   * @returns Promise that resolves when server is closed
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get the base URL for the server
   * @returns The base URL as a string
   */
  public getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Add a route to the server
   * @param path - URL path to respond to
   * @param handler - Function to handle the request
   */
  public addRoute(
    path: string,
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
  ): void {
    this.routes.set(path, handler);
  }

  /**
   * Add common test routes
   */
  public addCommonRoutes(): void {
    // Root route with HTML content
    this.addRoute('/', (_, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Test Heading</h1>
            <div class="content">
              <p>This is a test paragraph.</p>
            </div>
          </body>
        </html>
      `);
    });

    // JSON endpoint
    this.addRoute('/json', (_, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        id: 1,
        title: 'Test Post',
        body: 'This is a test post body'
      }));
    });

    // Redirect endpoint
    this.addRoute('/redirect', (_, res) => {
      res.statusCode = 302;
      res.setHeader('Location', '/');
      res.end();
    });

    // Status endpoint
    this.addRoute('/status', (_, res) => {
      res.statusCode = 200;
      res.end('OK');
    });
    
    // Error endpoint that destroys the connection
    this.addRoute('/error', (_, res) => {
      // Simulate a connection error by destroying the socket
      res.socket?.destroy();
    });
  }
}
