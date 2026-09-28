import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
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

export interface UnoServerOptions {
  config?: Partial<ServerConfig>;
  stats?: StatsService;
  manager?: RoomManagerOptions;
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

/** Builds the HTTP + Socket.IO server without listening, so tests can spin up isolated instances. */
export function createUnoServer(options: UnoServerOptions = {}): UnoServer {
  const config: ServerConfig = { ...loadConfig(), ...options.config };
  const stats = options.stats ?? new MemoryStatsService();
  const origin = config.clientOrigins.length > 0 ? config.clientOrigins : true;

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

  app.get('/', (_req, res) => {
    res.json({ name: 'UNO Party server', status: 'ok' });
  });
  app.get('/health', (_req, res) => {
    res.json({ ok: true, uptime: Math.round(process.uptime()), stats: stats.kind, ...manager.metrics() });
  });
  app.use('/api', createStatsRouter(stats));
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
