import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  idParamsSchema,
  listCatalogQuerySchema,
  paginated,
  upsertWarehouseSchema,
  warehouseSchema,
} from '@stockpro/shared';
import { createWarehouseService } from './service';

export const warehouseRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  const service = createWarehouseService(app.db);
  const canWrite = app.requirePermission('warehouses');
  const tags = ['warehouses'];

  app.get(
    '/',
    {
      schema: {
        tags,
        querystring: listCatalogQuerySchema,
        response: { 200: paginated(warehouseSchema) },
      },
    },
    async (req) => service.list(req.auth, req.query),
  );

  app.post(
    '/',
    {
      onRequest: canWrite,
      schema: { tags, body: upsertWarehouseSchema, response: { 201: warehouseSchema } },
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
        body: upsertWarehouseSchema,
        response: { 200: warehouseSchema },
      },
    },
    async (req) => service.update(req.auth, req.params.id, req.body),
  );

  app.post(
    '/:id/default',
    {
      onRequest: canWrite,
      schema: { tags, params: idParamsSchema, response: { 200: warehouseSchema } },
    },
    async (req) => service.setDefault(req.auth, req.params.id),
  );

  app.delete(
    '/:id',
    {
      onRequest: canWrite,
      schema: { tags, params: idParamsSchema, response: { 204: z.null() } },
    },
    async (req, reply) => {
      await service.remove(req.auth, req.params.id);
      return reply.status(204).send(null);
    },
  );
};
