import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { checkOrigin, resolveAllowedOrigins } from '../src/server';
import { logger } from '../src/utils/logger';

describe('loadConfig: CLIENT_ORIGIN normalization', () => {
  it('splits on commas, trims spaces, drops empty entries', () => {
    const config = loadConfig({ CLIENT_ORIGIN: ' https://a.example.com , https://b.example.com ,, ' });
    expect(config.clientOrigins).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('strips wrapping quotes and a trailing slash', () => {
    const config = loadConfig({ CLIENT_ORIGIN: '"https://example.com/"' });
    expect(config.clientOrigins).toEqual(['https://example.com']);
  });

  it('strips single quotes too, and collapses multiple trailing slashes', () => {
    const config = loadConfig({ CLIENT_ORIGIN: "'https://example.com///'" });
    expect(config.clientOrigins).toEqual(['https://example.com']);
  });

  it('is empty (allow any origin) when CLIENT_ORIGIN is unset', () => {
    const config = loadConfig({});
    expect(config.clientOrigins).toEqual([]);
  });

  it('"https://example.com/" in CLIENT_ORIGIN allows the origin "https://example.com"', () => {
    const config = loadConfig({ CLIENT_ORIGIN: '"https://example.com/"' });
    expect(config.clientOrigins).toContain('https://example.com');
  });
});

describe('loadConfig: selfOrigin (RENDER_EXTERNAL_URL)', () => {
  it('is null when RENDER_EXTERNAL_URL is unset', () => {
    expect(loadConfig({}).selfOrigin).toBeNull();
  });

  it('normalizes RENDER_EXTERNAL_URL the same way as CLIENT_ORIGIN entries', () => {
    const config = loadConfig({ RENDER_EXTERNAL_URL: ' "https://uno-party.onrender.com/" ' });
    expect(config.selfOrigin).toBe('https://uno-party.onrender.com');
  });
});

describe('resolveAllowedOrigins', () => {
  const base = { port: 3001, mongoUri: null, trustProxy: false, isProduction: false };

  it('allows any origin (empty list) when CLIENT_ORIGIN is unset, even with a selfOrigin', () => {
    expect(resolveAllowedOrigins({ ...base, clientOrigins: [], selfOrigin: 'https://uno-party.onrender.com' })).toEqual([]);
  });

  it('always allows its own address, even when CLIENT_ORIGIN omits it', () => {
    const allowed = resolveAllowedOrigins({
      ...base,
      clientOrigins: ['https://party-night.example'],
      selfOrigin: 'https://uno-party.onrender.com',
    });
    expect(allowed).toEqual(['https://party-night.example', 'https://uno-party.onrender.com']);
  });

  it("doesn't duplicate selfOrigin when CLIENT_ORIGIN already includes it", () => {
    const allowed = resolveAllowedOrigins({
      ...base,
      clientOrigins: ['https://uno-party.onrender.com'],
      selfOrigin: 'https://uno-party.onrender.com',
    });
    expect(allowed).toEqual(['https://uno-party.onrender.com']);
  });

  it('is just CLIENT_ORIGIN when there is no selfOrigin', () => {
    const allowed = resolveAllowedOrigins({ ...base, clientOrigins: ['https://party-night.example'], selfOrigin: null });
    expect(allowed).toEqual(['https://party-night.example']);
  });
});

describe('checkOrigin', () => {
  it('allows an origin in the list, quietly', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const callback = vi.fn();
    checkOrigin(['https://example.com'])('https://example.com', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('allows a request with no Origin header, quietly', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const callback = vi.fn();
    checkOrigin(['https://example.com'])(undefined, callback);
    expect(callback).toHaveBeenCalledWith(null, true);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('rejects an origin not in the list, and logs one warning with the origin and the allowed list', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const callback = vi.fn();
    checkOrigin(['https://example.com'])('https://evil.example', callback);
    expect(callback).toHaveBeenCalledWith(null, false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.any(String), {
      origin: 'https://evil.example',
      allowed: ['https://example.com'],
    });
    warn.mockRestore();
  });
});
