import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createProductSchema,
  idParamsSchema,
  listProductsQuerySchema,
  paginated,
  productSchema,
  updateProductSchema,
} from '@stockpro/shared';
import { AppError } from '../../lib/errors';
import { createProductService } from './service';

export const productRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  const service = createProductService(app.db);
  const tags = ['products'];
  const canWrite = app.requirePermission('products');
  const canRead = async (req: { auth: { permissions: ReadonlySet<string> } }) => {
    const p = req.auth.permissions;
    if (!p.has('products') && !p.has('kardex') && !p.has('reports')) throw AppError.forbidden();
  };

  app.get(
    '/',
    {
      onRequest: canRead,
      schema: {
        tags,
        querystring: listProductsQuerySchema,
        response: { 200: paginated(productSchema) },
      },
    },
    async (req) => service.list(req.auth, req.query),
  );

  app.get(
    '/:id',
    {
      onRequest: canRead,
      schema: { tags, params: idParamsSchema, response: { 200: productSchema } },
    },
    async (req) => service.get(req.auth, req.params.id),
  );

  app.post(
    '/',
    {
      onRequest: canWrite,
      schema: { tags, body: createProductSchema, response: { 201: productSchema } },
    },
    async (req, reply) => reply.status(201).send(await service.create(req.auth, req.body)),
  );

  app.put(
    '/:id',
    {
      onRequest: canWrite,
      schema: {
        tags,
        params: idParamsSchema,
        body: updateProductSchema,
        response: { 200: productSchema },
      },
    },
    async (req) => service.update(req.auth, req.params.id, req.body),
  );

  app.delete(
    '/:id',
    { onRequest: canWrite, schema: { tags, params: idParamsSchema, response: { 204: z.null() } } },
    async (req, reply) => {
      await service.remove(req.auth, req.params.id);
      return reply.status(204).send(null);
    },
  );
};
