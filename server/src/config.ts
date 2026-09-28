export interface ServerConfig {
  port: number;
  /** Allowed browser origins. Empty = allow any origin (development convenience). */
  clientOrigins: string[];
  mongoUri: string | null;
  trustProxy: boolean;
  isProduction: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const origins = (env.CLIENT_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const port = Number.parseInt(env.PORT ?? '', 10);
  return {
    port: Number.isFinite(port) && port > 0 ? port : 3001,
    clientOrigins: origins,
    mongoUri: env.MONGODB_URI?.trim() || null,
    trustProxy: /^(1|true|yes)$/i.test(env.TRUST_PROXY ?? ''),
    isProduction: env.NODE_ENV === 'production',
  };
}
