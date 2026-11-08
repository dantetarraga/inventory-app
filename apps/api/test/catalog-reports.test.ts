import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../src/app';
import { createProduct, createTestApp, move, registerCompany, type TestSession } from './helpers';

let app: App;
let admin: TestSession;
beforeAll(async () => {
  app = await createTestApp();
  admin = await registerCompany(app);
});
afterAll(async () => {
  await app.close();
});

describe('catalog', () => {
  it('enforces unique names per company (case-insensitive)', async () => {
    const a = await app.inject({
      method: 'POST',
      url: '/api/brands',
      headers: admin.headers,
      payload: { name: 'Gloria' },
    });
    expect(a.statusCode).toBe(201);
    const b = await app.inject({
      method: 'POST',
      url: '/api/brands',
      headers: admin.headers,
      payload: { name: 'GLORIA' },
    });
    expect(b.statusCode).toBe(409);
    const other = await registerCompany(app);
    const c = await app.inject({
      method: 'POST',
      url: '/api/brands',
      headers: other.headers,
      payload: { name: 'Gloria' },
    });
    expect(c.statusCode).toBe(201);
  });

  it('blocks deleting a category that has products', async () => {
    const cat = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: admin.headers,
      payload: { name: 'Lácteos', color: '#ffffff' },
    });
    await createProduct(app, admin, { categoryId: cat.json().id });
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/categories/${cat.json().id}`,
      headers: admin.headers,
    });
    expect(del.statusCode).toBe(409);
  });

  it('searches products by name, barcode and code, escaping wildcards', async () => {
    await createProduct(app, admin, { name: 'Leche evaporada', barcode: '7751234500001' });
    await createProduct(app, admin, { name: 'Descuento 100%' });
    const byName = await app.inject({
      method: 'GET',
      url: '/api/products?q=evapor',
      headers: admin.headers,
    });
    expect(byName.json().items.map((p: { name: string }) => p.name)).toEqual(['Leche evaporada']);
    const byBarcode = await app.inject({
      method: 'GET',
      url: '/api/products?q=77512345',
      headers: admin.headers,
    });
    expect(byBarcode.json().total).toBe(1);
    const pct = await app.inject({
      method: 'GET',
      url: '/api/products?q=%25',
      headers: admin.headers,
    });
    expect(pct.json().items.map((p: { name: string }) => p.name)).toEqual(['Descuento 100%']);
  });

  it('paginates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/products?pageSize=1&page=2',
      headers: admin.headers,
    });
    expect(res.json().items).toHaveLength(1);
    expect(res.json().total).toBeGreaterThanOrEqual(2);
  });
});

describe('reports', () => {
  it('values inventory with exact decimals and flags low stock', async () => {
    const s = await registerCompany(app);
    await createProduct(app, s, {
      name: 'A',
      purchasePrice: '0.10',
      minStock: '5',
      initialStock: '3',
    });
    await createProduct(app, s, {
      name: 'B',
      purchasePrice: '0.20',
      minStock: '1',
      initialStock: '10',
    });

    const val = await app.inject({
      method: 'GET',
      url: '/api/reports/valuation',
      headers: s.headers,
    });
    expect(val.json().grandTotal).toBe('2.30');

    const low = await app.inject({
      method: 'GET',
      url: '/api/reports/low-stock',
      headers: s.headers,
    });
    expect(low.json().map((r: { name: string }) => r.name)).toEqual(['A']);

    const dash = await app.inject({
      method: 'GET',
      url: '/api/dashboard/summary',
      headers: s.headers,
    });
    expect(dash.statusCode).toBe(200);
    expect(dash.json().totals).toMatchObject({ products: 2, lowStock: 1, inventoryValue: '2.30' });
    expect(dash.json().monthly).toHaveLength(6);
  });

  it('exports kardex as xlsx', async () => {
    const p = await createProduct(app, admin, { initialStock: '4' });
    await move(app, admin, { type: 'out', productId: p.id, quantity: '1' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/kardex?format=xlsx',
      headers: admin.headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.rawPayload.subarray(0, 2).toString()).toBe('PK'); // xlsx is a zip
  });
});
