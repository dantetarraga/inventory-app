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

const getProduct = async (id: number) =>
  (await app.inject({ method: 'GET', url: `/api/products/${id}`, headers: admin.headers })).json();

describe('kardex', () => {
  it('in 10, out 3 → stock 7 with running balance', async () => {
    const p = await createProduct(app, admin);
    expect(p.stock).toBe('0.000');

    const inRes = await move(app, admin, { type: 'in', productId: p.id, quantity: '10' });
    expect(inRes.statusCode).toBe(201);
    expect(inRes.json()).toMatchObject({ type: 'in', delta: '10.000', balanceAfter: '10.000' });

    const outRes = await move(app, admin, { type: 'out', productId: p.id, quantity: '3' });
    expect(outRes.json()).toMatchObject({ type: 'out', delta: '-3.000', balanceAfter: '7.000' });

    expect((await getProduct(p.id)).stock).toBe('7.000');

    const list = await app.inject({
      method: 'GET',
      url: `/api/kardex?productId=${p.id}`,
      headers: admin.headers,
    });
    expect(list.json().total).toBe(2);
    expect(list.json().items[0].type).toBe('out');
  });

  it('registers opening stock as an "in" movement', async () => {
    const p = await createProduct(app, admin, { initialStock: '12.5' });
    expect(p.stock).toBe('12.500');
    const list = await app.inject({
      method: 'GET',
      url: `/api/kardex?productId=${p.id}`,
      headers: admin.headers,
    });
    expect(list.json().items[0]).toMatchObject({ type: 'in', note: 'Stock inicial' });
  });

  it('rejects outputs larger than the available stock', async () => {
    const p = await createProduct(app, admin, { initialStock: '2' });
    const res = await move(app, admin, { type: 'out', productId: p.id, quantity: '5' });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('INSUFFICIENT_STOCK');
    expect((await getProduct(p.id)).stock).toBe('2.000');
  });

  it('adjust sets the counted stock and records the signed delta', async () => {
    const p = await createProduct(app, admin, { initialStock: '10' });
    const res = await move(app, admin, { type: 'adjust', productId: p.id, quantity: '8' });
    expect(res.json()).toMatchObject({ delta: '-2.000', balanceAfter: '8.000' });
    const same = await move(app, admin, { type: 'adjust', productId: p.id, quantity: '8' });
    expect(same.statusCode).toBe(400);
  });

  it('never goes negative under concurrent outputs', async () => {
    const p = await createProduct(app, admin, { initialStock: '5' });
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        move(app, admin, { type: 'out', productId: p.id, quantity: '1' }),
      ),
    );
    const ok = results.filter((r) => r.statusCode === 201).length;
    const rejected = results.filter((r) => r.statusCode === 409).length;
    expect(ok).toBe(5);
    expect(rejected).toBe(7);
    expect((await getProduct(p.id)).stock).toBe('0.000');
  });

  it('keeps stock per warehouse', async () => {
    const wh = await app.inject({
      method: 'POST',
      url: '/api/warehouses',
      headers: admin.headers,
      payload: { name: 'Sucursal 2' },
    });
    expect(wh.statusCode).toBe(201);
    const p = await createProduct(app, admin, { initialStock: '3' });
    await move(app, admin, {
      type: 'in',
      productId: p.id,
      quantity: '4',
      warehouseId: wh.json().id,
    });
    // Default warehouse only has 3
    const res = await move(app, admin, { type: 'out', productId: p.id, quantity: '4' });
    expect(res.statusCode).toBe(409);
    expect((await getProduct(p.id)).stock).toBe('7.000');

    const report = await app.inject({
      method: 'GET',
      url: `/api/reports/stock/${p.id}`,
      headers: admin.headers,
    });
    const stocks = report
      .json()
      .warehouses.map((w: { stock: string }) => w.stock)
      .sort();
    expect(stocks).toEqual(['3.000', '4.000']);
  });

  it('rejects stock edits through the product endpoint', async () => {
    const p = await createProduct(app, admin, { initialStock: '3' });
    const res = await app.inject({
      method: 'PUT',
      url: `/api/products/${p.id}`,
      headers: admin.headers,
      payload: { name: p.name, salePrice: '1', purchasePrice: '1', minStock: '0', stock: '999' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().stock).toBe('3.000');
  });
});
