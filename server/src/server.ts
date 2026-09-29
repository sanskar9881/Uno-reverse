import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Express } from 'express';
import helmet from 'helmet';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared';
import { loadConfig, type ServerConfig } from './config';
import { RoomManager, type RoomManagerOptions } from './rooms/RoomManager';
import { createStatsRouter } from './routes/stats';
import { MemoryStatsService } from './services/stats/MemoryStatsService';
import type { StatsService } from './services/stats/StatsService';
import { createSocketNotifier, type TypedServer } from './socket/notifier';
import { registerSocketHandlers } from './socket/registerHandlers';
import { logger } from './utils/logger';

/**
 * The built client, relative to this module. Works both from source (`server/src`, e.g.
 * in tests) and from the bundled build (`server/dist`), since both sit two levels under
 * the repo root, right alongside `client/dist`.
 */
const DEFAULT_CLIENT_DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

/** Routes this server handles itself; the single-page-app fallback must never catch these. */
const RESERVED_PATH = /^\/(api|socket\.io|health)(\/|$)/;

export interface UnoServerOptions {
  config?: Partial<ServerConfig>;
  stats?: StatsService;
  manager?: RoomManagerOptions;
  /** Where to serve the built client from in production. Defaults to ../../client/dist; overridable for tests. */
  clientDistDir?: string;
}

export interface UnoServer {
  app: Express;
  httpServer: HttpServer;
  io: TypedServer;
  manager: RoomManager;
  stats: StatsService;
  listen(port?: number): Promise<number>;
  close(): Promise<void>;
}

type OriginCallback = (err: Error | null, allow?: boolean) => void;

/** Allows anything in `allowed`, and warns once per rejection so a misconfigured CLIENT_ORIGIN is easy to spot. */
export function checkOrigin(allowed: string[]): (origin: string | undefined, callback: OriginCallback) => void {
  return (requestOrigin, callback) => {
    if (!requestOrigin || allowed.includes(requestOrigin)) {
      callback(null, true);
      return;
    }
    logger.warn('Rejected a request from a disallowed origin', { origin: requestOrigin, allowed });
    callback(null, false);
  };
}

/**
 * `clientOrigins` plus the server's own address (if known), unless `clientOrigins` is empty —
 * empty means "allow any origin," which already covers the server's own address too.
 */
export function resolveAllowedOrigins(config: ServerConfig): string[] {
  if (config.clientOrigins.length === 0) return [];
  if (!config.selfOrigin || config.clientOrigins.includes(config.selfOrigin)) return config.clientOrigins;
  return [...config.clientOrigins, config.selfOrigin];
}

/** Builds the HTTP + Socket.IO server without listening, so tests can spin up isolated instances. */
export function createUnoServer(options: UnoServerOptions = {}): UnoServer {
  const config: ServerConfig = { ...loadConfig(), ...options.config };
  const stats = options.stats ?? new MemoryStatsService();
  const allowedOrigins = resolveAllowedOrigins(config);
  const origin = allowedOrigins.length > 0 ? checkOrigin(allowedOrigins) : true;

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin }));
  app.use(express.json({ limit: '10kb' }));

  const httpServer = createServer(app);
  const io: TypedServer = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin },
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });

  const manager = new RoomManager(createSocketNotifier(io), { stats, ...options.manager });
  registerSocketHandlers(io, manager, { trustProxy: config.trustProxy });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()), stats: stats.kind, ...manager.metrics() });
  });
  app.use('/api', createStatsRouter(stats));

  if (config.isProduction) {
    // Single-service deploy: serve the built client, falling back to index.html for any
    // client-side route so deep links and refreshes work — but never for our own routes.
    const clientDistDir = options.clientDistDir ?? DEFAULT_CLIENT_DIST_DIR;
    app.use(express.static(clientDistDir));
    app.get(/.*/, (req, res, next) => {
      if (RESERVED_PATH.test(req.path)) {
        next();
        return;
      }
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({ name: 'UNO Party server', status: 'ok' });
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    logger.error('HTTP request failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Internal server error' });
  };
  app.use(onError);

  return {
    app,
    httpServer,
    io,
    manager,
    stats,
    listen(port = config.port) {
      return new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(port, () => {
          httpServer.off('error', reject);
          resolve((httpServer.address() as AddressInfo).port);
        });
      });
    },
    close() {
      manager.dispose();
      return new Promise((resolve) => {
        io.close(() => resolve());
      });
    },
  };
}
