import { loadConfig } from './config';
import { createUnoServer } from './server';
import { createStatsService } from './services/stats';
import { logger } from './utils/logger';

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on real environment variables (e.g. on Render).
}

const config = loadConfig();
if (config.clientOrigins.length === 0) {
  logger.warn('CLIENT_ORIGIN is not set, so any website can connect. Set it to your client URL in production.');
}

const stats = await createStatsService(config.mongoUri);
const server = createUnoServer({ config, stats });
const port = await server.listen(config.port);
logger.info(`UNO Party server listening on http://localhost:${port}`);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down`);
  setTimeout(() => process.exit(1), 5000).unref();
  try {
    await server.close();
    await stats.close();
  } catch (error) {
    logger.error('Error during shutdown', { error: String(error) });
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', { reason: String(reason) }));
