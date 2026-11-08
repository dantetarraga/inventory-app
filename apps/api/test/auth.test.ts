import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { createTestApp, login, PASSWORD, registerCompany } from './helpers';

let app: App;
beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});

const refresh = (cookie: string, csrf = true) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    headers: { cookie, ...(csrf ? { 'x-requested-with': 'stockpro' } : {}) },
  });

describe('auth', () => {
  it('registers an admin with full permissions and a refresh cookie', async () => {
    const s = await registerCompany(app, 'Mi Bodega');
    expect(s.auth.me.user.role).toBe('admin');
    expect(s.auth.me.user.permissions).toContain('products');
    expect(s.auth.me.company.name).toBe('Mi Bodega');
    expect(s.cookie).toMatch(/^stockpro_rt=/);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: s.headers });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe(s.auth.me.user.email);
  });

  it('rejects duplicate emails with 409', async () => {
    const s = await registerCompany(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        fullName: 'Otro Admin',
        email: s.auth.me.user.email.toUpperCase(),
        password: PASSWORD,
        companyName: 'Otra',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().title).toMatch(/email/i);
  });

  it('validates input with problem+json details', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { fullName: 'A', email: 'not-an-email', password: 'short', companyName: 'X' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('rejects bad credentials without revealing which part failed', async () => {
    const s = await registerCompany(app);
    const wrongPass = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: s.auth.me.user.email, password: 'Wrong1234' },
    });
    const noUser = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@test.dev', password: 'Wrong1234' },
    });
    expect(wrongPass.statusCode).toBe(401);
    expect(noUser.statusCode).toBe(401);
    expect(wrongPass.json().title).toBe(noUser.json().title);
  });

  it('requires a bearer token on protected routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/products' });
    expect(res.statusCode).toBe(401);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const s = await registerCompany(app);
    const first = await refresh(s.cookie);
    expect(first.statusCode).toBe(200);
    const rotated = first.cookies.find((c) => c.name === 'stockpro_rt')!;
    expect(`stockpro_rt=${rotated.value}`).not.toBe(s.cookie);

    const reuse = await refresh(s.cookie);
    expect(reuse.statusCode).toBe(401);
    const afterReuse = await refresh(`stockpro_rt=${rotated.value}`);
    expect(afterReuse.statusCode).toBe(401);
  });

  it('requires the CSRF header for cookie endpoints', async () => {
    const s = await registerCompany(app);
    const res = await refresh(s.cookie, false);
    expect(res.statusCode).toBe(403);
  });

  it('logout revokes the refresh token', async () => {
    const s = await registerCompany(app);
    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: s.cookie, 'x-requested-with': 'stockpro' },
    });
    expect(out.statusCode).toBe(204);
    expect((await refresh(s.cookie)).statusCode).toBe(401);
    await expect(login(app, s.auth.me.user.email)).resolves.toBeTruthy();
  });
});
