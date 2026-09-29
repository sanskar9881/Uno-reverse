export interface ServerConfig {
  port: number;
  /** Allowed browser origins. Empty = allow any origin (development convenience). */
  clientOrigins: string[];
  /** This service's own public URL (Render sets RENDER_EXTERNAL_URL), always allowed regardless of CLIENT_ORIGIN. */
  selfOrigin: string | null;
  mongoUri: string | null;
  trustProxy: boolean;
  isProduction: boolean;
}

/** Trims whitespace, strips wrapping quotes, and drops a trailing slash. */
function normalizeOrigin(raw: string): string {
  return raw
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
    .replace(/\/+$/, '');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const origins = (env.CLIENT_ORIGIN ?? '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  const selfOrigin = env.RENDER_EXTERNAL_URL ? normalizeOrigin(env.RENDER_EXTERNAL_URL) || null : null;
  const port = Number.parseInt(env.PORT ?? '', 10);
  return {
    port: Number.isFinite(port) && port > 0 ? port : 3001,
    clientOrigins: origins,
    selfOrigin,
    mongoUri: env.MONGODB_URI?.trim() || null,
    trustProxy: /^(1|true|yes)$/i.test(env.TRUST_PROXY ?? ''),
    isProduction: env.NODE_ENV === 'production',
  };
}
