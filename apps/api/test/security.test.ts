import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import {
  createEmployee,
  createProduct,
  createTestApp,
  move,
  PASSWORD,
  registerCompany,
  type TestSession,
} from './helpers';

let app: App;
let companyA: TestSession;
let companyB: TestSession;
beforeAll(async () => {
  app = await createTestApp();
  companyA = await registerCompany(app, 'Empresa A');
  companyB = await registerCompany(app, 'Empresa B');
});
afterAll(async () => {
  await app.close();
});

describe('multi-tenant isolation', () => {
  it('a company cannot read, edit or move another company’s products', async () => {
    const p = await createProduct(app, companyA, { initialStock: '5' });

    const get = await app.inject({
      method: 'GET',
      url: `/api/products/${p.id}`,
      headers: companyB.headers,
    });
    expect(get.statusCode).toBe(404);

    const list = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: companyB.headers,
    });
    expect(list.json().items.find((i: { id: number }) => i.id === p.id)).toBeUndefined();

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/products/${p.id}`,
      headers: companyB.headers,
    });
    expect(del.statusCode).toBe(404);

    const mv = await move(app, companyB, { type: 'out', productId: p.id, quantity: '1' });
    expect(mv.statusCode).toBe(404);
  });

  it('rejects references to another company’s category', async () => {
    const cat = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: companyA.headers,
      payload: { name: 'Solo A' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: companyB.headers,
      payload: {
        name: 'X',
        salePrice: '1',
        purchasePrice: '1',
        minStock: '0',
        categoryId: cat.json().id,
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('module permissions', () => {
  it('an employee without "products" cannot create products but kardex users can look them up', async () => {
    const { session } = await createEmployee(app, companyA, ['kardex']);
    const create = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: session.headers,
      payload: { name: 'X', salePrice: '1', purchasePrice: '1', minStock: '0' },
    });
    expect(create.statusCode).toBe(403);

    const list = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: session.headers,
    });
    expect(list.statusCode).toBe(200);

    const reports = await app.inject({
      method: 'GET',
      url: '/api/reports/stock',
      headers: session.headers,
    });
    expect(reports.statusCode).toBe(403);
  });

  it('rejects missing permissions in onRequest, before the body is parsed/validated', async () => {
    const { session } = await createEmployee(app, companyA, ['kardex']);
    const res = await app.inject({
      method: 'POST',
      url: '/api/products',
      headers: session.headers,
      payload: { invalid: true }, // would be a 400 if validation ran first
    });
    expect(res.statusCode).toBe(403);
  });

  it('permission changes apply immediately to existing tokens', async () => {
    const { user, session } = await createEmployee(app, companyA, ['reports']);
    expect(
      (await app.inject({ method: 'GET', url: '/api/reports/stock', headers: session.headers }))
        .statusCode,
    ).toBe(200);

    await app.inject({
      method: 'PUT',
      url: `/api/users/${user.id}`,
      headers: companyA.headers,
      payload: { fullName: user.fullName, role: 'employee', status: 'active', permissions: [] },
    });
    expect(
      (await app.inject({ method: 'GET', url: '/api/reports/stock', headers: session.headers }))
        .statusCode,
    ).toBe(403);
  });

  it('deactivated users are rejected even with a valid access token', async () => {
    const { user, session } = await createEmployee(app, companyA, ['kardex']);
    await app.inject({
      method: 'PUT',
      url: `/api/users/${user.id}`,
      headers: companyA.headers,
      payload: {
        fullName: user.fullName,
        role: 'employee',
        status: 'inactive',
        permissions: ['kardex'],
      },
    });
    const res = await app.inject({ method: 'GET', url: '/api/kardex', headers: session.headers });
    expect(res.statusCode).toBe(401);
  });

  it('an employee with "users" cannot create or promote admins', async () => {
    const { user, session } = await createEmployee(app, companyA, ['users']);
    const createAdmin = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: session.headers,
      payload: { fullName: 'Hacker', email: 'h@test.dev', password: PASSWORD, role: 'admin' },
    });
    expect(createAdmin.statusCode).toBe(403);

    const selfPromote = await app.inject({
      method: 'PUT',
      url: `/api/users/${user.id}`,
      headers: session.headers,
      payload: { fullName: user.fullName, role: 'admin', status: 'active', permissions: [] },
    });
    expect(selfPromote.statusCode).toBe(403);
  });

  it('the last admin cannot demote or delete themselves', async () => {
    const s = await registerCompany(app);
    const res = await app.inject({
      method: 'PUT',
      url: `/api/users/${s.auth.me.user.id}`,
      headers: s.headers,
      payload: { fullName: 'Admin', role: 'employee', status: 'active', permissions: [] },
    });
    expect(res.statusCode).toBe(400);
  });
});
