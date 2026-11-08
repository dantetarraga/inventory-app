import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, FRIENDLY_MESSAGES } from './http';

const respond = (status: number, body: string, contentType = 'application/problem+json') =>
  vi
    .fn()
    .mockResolvedValue(new Response(body, { status, headers: { 'content-type': contentType } }));

afterEach(() => vi.unstubAllGlobals());

async function errorOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected a rejection');
}

describe('api error messages', () => {
  it('server unreachable (network failure) → offline message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await errorOf(api('/auth/login', { method: 'POST', body: {} }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe(FRIENDLY_MESSAGES.offline);
    expect(err.status).toBe(0);
  });

  it('proxy 500 with no body (API down) → unavailable, never "Internal Server Error"', async () => {
    vi.stubGlobal('fetch', respond(500, '', 'text/plain'));
    const err = await errorOf(api('/auth/login', { method: 'POST', body: {} }));
    expect(err.message).toBe(FRIENDLY_MESSAGES.unavailable);
    expect(err.message).not.toMatch(/internal server error/i);
  });

  it('API 500 problem → generic server message (no technical title)', async () => {
    vi.stubGlobal(
      'fetch',
      respond(500, JSON.stringify({ title: 'boom: null pointer', status: 500, code: 'INTERNAL' })),
    );
    const err = await errorOf(api('/products'));
    expect(err.message).toBe(FRIENDLY_MESSAGES.server);
  });

  it('API 4xx problem → keeps the API message and field errors', async () => {
    vi.stubGlobal(
      'fetch',
      respond(
        401,
        JSON.stringify({
          title: 'Email o contraseña incorrectos',
          status: 401,
          code: 'INVALID_CREDENTIALS',
        }),
      ),
    );
    const err = await errorOf(api('/auth/login', { method: 'POST', body: {} }));
    expect(err.message).toBe('Email o contraseña incorrectos');
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });
});
