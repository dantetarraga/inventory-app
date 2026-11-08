import Fastify, { type FastifyServerOptions } from 'fastify';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { problemSchema } from '@stockpro/shared';
import { createDb, type Database } from './db/client';
import type { Env } from './env';
import authPlugin from './plugins/auth';
import errorsPlugin from './plugins/errors';
import { authRoutes } from './modules/auth/routes';
import { companyRoutes } from './modules/company/routes';
import { userRoutes } from './modules/users/routes';
import { categoryRoutes } from './modules/categories/routes';
import { brandRoutes } from './modules/brands/routes';
import { warehouseRoutes } from './modules/warehouses/routes';
import { productRoutes } from './modules/products/routes';
import { kardexRoutes } from './modules/kardex/routes';
import { reportRoutes } from './modules/reports/routes';
import { dashboardRoutes } from './modules/dashboard/routes';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    db: Database;
  }
}

export interface BuildAppOptions {
  env: Env;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp({ env, logger }: BuildAppOptions) {
  const app = Fastify({
    logger: logger ?? {
      level: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: env.NODE_ENV === 'production',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook('onRoute', (route) => {
    if (!route.schema || route.schema.hide) return;
    route.schema.response = {
      '4xx': problemSchema,
      '5xx': problemSchema,
      ...(route.schema.response as Record<string, unknown> | undefined),
    };
  });

  await app.register(
    fp(
      async (instance) => {
        instance.decorate('env', env);
      },
      { name: 'env' },
    ),
  );
  await app.register(
    fp(
      async (instance) => {
        const { db, pool } = createDb(env.DATABASE_URL);
        instance.decorate('db', db);
        instance.addHook('onClose', async () => pool.end());
      },
      { name: 'db' },
    ),
  );

  await app.register(errorsPlugin);
  await app.register(helmet, { contentSecurityPolicy: env.NODE_ENV === 'production' });
  await app.register(cors, { origin: env.WEB_ORIGIN.split(','), credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(authPlugin);

  if (env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: { title: 'StockPRO API', version: '1.0.0' },
        components: {
          securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
        },
        security: [{ bearer: [] }],
      },
      transform: jsonSchemaTransform,
    });
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  app.get('/health', { schema: { hide: true } }, async () => {
    await app.db.execute('select 1');
    return { status: 'ok' };
  });

  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(companyRoutes, { prefix: '/company' });
      await api.register(userRoutes, { prefix: '/users' });
      await api.register(categoryRoutes, { prefix: '/categories' });
      await api.register(brandRoutes, { prefix: '/brands' });
      await api.register(warehouseRoutes, { prefix: '/warehouses' });
      await api.register(productRoutes, { prefix: '/products' });
      await api.register(kardexRoutes, { prefix: '/kardex' });
      await api.register(reportRoutes, { prefix: '/reports' });
      await api.register(dashboardRoutes, { prefix: '/dashboard' });
    },
    { prefix: '/api' },
  );

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
