import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  createMovementSchema,
  listMovementsQuerySchema,
  movementSchema,
  paginated,
} from '@stockpro/shared';
import { createKardexService } from './service';

export const kardexRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requirePermission('kardex'));
  const service = createKardexService(app.db);
  const tags = ['kardex'];

  app.get(
    '/',
    {
      schema: {
        tags,
        querystring: listMovementsQuerySchema,
        response: { 200: paginated(movementSchema) },
      },
    },
    async (req) => service.list(req.auth, req.query),
  );

  app.post(
    '/',
    { schema: { tags, body: createMovementSchema, response: { 201: movementSchema } } },
    async (req, reply) => reply.status(201).send(await service.create(req.auth, req.body)),
  );
};
