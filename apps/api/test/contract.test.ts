import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { problemSchema } from '@stockpro/shared';
import type { App } from '../src/app';
import { createTestApp, registerCompany, type TestSession } from './helpers';

let app: App;
let admin: TestSession;
beforeAll(async () => {
  app = await createTestApp();
  admin = await registerCompany(app);
});
afterAll(async () => {
  await app.close();
});

const expectProblem = (res: Awaited<ReturnType<App['inject']>>, status: number, code: string) => {
  expect(res.statusCode).toBe(status);
  expect(res.headers['content-type']).toContain('application/problem+json');
  const body = problemSchema.parse(res.json());
  expect(body.code).toBe(code);
  expect(body.title).not.toMatch(
    /[A-Za-z]+ is not|Unsupported|Internal Server|Too big|Invalid input/,
  );
  return body;
};

describe('error contract: every error is a Spanish problem+json with a known code', () => {
  it('malformed JSON body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{bad',
    });
    expectProblem(res, 400, 'INVALID_BODY');
  });

  it('unsupported media type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'text/csv' },
      payload: 'a,b',
    });
    expectProblem(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('validation errors use Spanish messages, including zod defaults', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        fullName: 'Ana',
        email: 'ana@test.dev',
        password: 'Secret123',
        companyName: 'Bodega',
        currency: 'SOLES',
      },
    });
    const body = expectProblem(res, 400, 'VALIDATION_ERROR');
    const currency = body.errors?.find((e) => e.path === 'currency');
    expect(currency?.message).toMatch(/caracteres/);
  });

  it('unknown route, unauthenticated and not found resource', async () => {
    expectProblem(await app.inject({ method: 'GET', url: '/api/nope' }), 404, 'NOT_FOUND');
    expectProblem(await app.inject({ method: 'GET', url: '/api/products' }), 401, 'UNAUTHORIZED');
    expectProblem(
      await app.inject({ method: 'GET', url: '/api/products/999999', headers: admin.headers }),
      404,
      'NOT_FOUND',
    );
  });

  it('documents the problem schema for 4xx/5xx on every route in OpenAPI', async () => {
    const spec = (await app.inject({ method: 'GET', url: '/docs/json' })).json() as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };
    const operations = Object.values(spec.paths).flatMap((methods) => Object.values(methods));
    expect(operations.length).toBeGreaterThan(20);
    for (const op of operations) {
      expect(Object.keys(op.responses)).toEqual(expect.arrayContaining(['4XX', '5XX']));
    }
  });
});

describe('success contract', () => {
  it('lists are paginated with items/total/page/pageSize', async () => {
    for (const url of [
      '/api/products',
      '/api/categories',
      '/api/brands',
      '/api/warehouses',
      '/api/users',
      '/api/kardex',
    ]) {
      const body = (await app.inject({ method: 'GET', url, headers: admin.headers })).json();
      expect(Object.keys(body).sort()).toEqual(['items', 'page', 'pageSize', 'total']);
    }
  });
});
