import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createUnoServer, type UnoServer } from '../src/server';

let server: UnoServer | undefined;
let dir: string | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

async function startWithClientDist(): Promise<{ port: number; dir: string }> {
  dir = mkdtempSync(path.join(tmpdir(), 'uno-party-client-dist-'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><body>uno party app</body></html>');
  server = createUnoServer({ config: { isProduction: true, clientOrigins: [] }, clientDistDir: dir });
  const port = await server.listen(0);
  return { port, dir };
}

describe('serving the built client in production', () => {
  it('serves index.html at the root', async () => {
    const { port } = await startWithClientDist();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('uno party app');
  });

  it('falls back to index.html for a client-side route, so deep links and refreshes work', async () => {
    const { port } = await startWithClientDist();
    const res = await fetch(`http://127.0.0.1:${port}/room/ABC123`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('uno party app');
  });

  it('serves an actual file from the dist directory instead of falling back', async () => {
    const { port, dir: distDir } = await startWithClientDist();
    writeFileSync(path.join(distDir, 'app.js'), 'console.log("hi")');
    const res = await fetch(`http://127.0.0.1:${port}/app.js`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('console.log');
  });

  it('never falls back for /health, /api or /socket.io', async () => {
    const { port } = await startWithClientDist();

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.status).toBe(200);
    expect((await health.json()) as { ok: boolean }).toMatchObject({ ok: true });

    const api = await fetch(`http://127.0.0.1:${port}/api/nonexistent`);
    expect(api.status).toBe(404);
    expect((await api.json()) as { error: string }).toMatchObject({ error: 'Not found' });

    // No Socket.IO server is listening on a plain GET here, but the path must still never
    // resolve to the SPA fallback — engine.io answers its own (non-HTML) response.
    const socketIo = await fetch(`http://127.0.0.1:${port}/socket.io/?EIO=4&transport=polling`);
    const body = await socketIo.text();
    expect(body).not.toContain('uno party app');
  });

  it('outside production, serves the plain JSON status page instead', async () => {
    server = createUnoServer({ config: { isProduction: false, clientOrigins: [] } });
    const port = await server.listen(0);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: 'UNO Party server', status: 'ok' });
  });
});
