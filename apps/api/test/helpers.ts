import { randomUUID } from 'node:crypto';
import { buildApp, type App } from '../src/app';
import { loadEnv } from '../src/env';
import { testDatabaseUrl } from './global-setup';
import type { AuthResponse, ModuleCode, Product, User } from '@stockpro/shared';

export async function createTestApp(): Promise<App> {
  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
  });
  const app = await buildApp({ env, logger: false });
  await app.ready();
  return app;
}

export const PASSWORD = 'Secret123';

export interface TestSession {
  token: string;
  cookie: string;
  auth: AuthResponse;
  headers: { authorization: string };
}

function sessionFrom(res: {
  json: () => unknown;
  cookies: Array<{ name: string; value: string }>;
}): TestSession {
  const auth = res.json() as AuthResponse;
  const rt = res.cookies.find((c) => c.name === 'stockpro_rt');
  return {
    token: auth.accessToken,
    cookie: rt ? `stockpro_rt=${rt.value}` : '',
    auth,
    headers: { authorization: `Bearer ${auth.accessToken}` },
  };
}

export async function registerCompany(app: App, name = 'Empresa Test'): Promise<TestSession> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      fullName: 'Admin Test',
      email: `admin-${randomUUID()}@test.dev`,
      password: PASSWORD,
      companyName: name,
    },
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  return sessionFrom(res);
}

export async function login(app: App, email: string, password = PASSWORD): Promise<TestSession> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  return sessionFrom(res);
}

export async function createEmployee(
  app: App,
  admin: TestSession,
  permissions: ModuleCode[],
): Promise<{ user: User; session: TestSession }> {
  const email = `emp-${randomUUID()}@test.dev`;
  const res = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: admin.headers,
    payload: { fullName: 'Empleado', email, password: PASSWORD, role: 'employee', permissions },
  });
  if (res.statusCode !== 201) throw new Error(`create user failed: ${res.statusCode} ${res.body}`);
  return { user: res.json() as User, session: await login(app, email) };
}

export async function createProduct(
  app: App,
  session: TestSession,
  overrides: Record<string, unknown> = {},
): Promise<Product> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/products',
    headers: session.headers,
    payload: {
      name: `Producto ${randomUUID().slice(0, 8)}`,
      salePrice: '10.00',
      purchasePrice: '6.50',
      minStock: '5',
      ...overrides,
    },
  });
  if (res.statusCode !== 201)
    throw new Error(`create product failed: ${res.statusCode} ${res.body}`);
  return res.json() as Product;
}

export async function move(
  app: App,
  session: TestSession,
  payload: {
    type: 'in' | 'out' | 'adjust';
    productId: number;
    quantity: string;
    warehouseId?: number;
  },
) {
  return app.inject({ method: 'POST', url: '/api/kardex', headers: session.headers, payload });
}
