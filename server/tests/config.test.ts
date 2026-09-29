import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { checkOrigin } from '../src/server';
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
