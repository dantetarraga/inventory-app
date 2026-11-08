import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createUserSchema,
  idParamsSchema,
  listUsersQuerySchema,
  paginated,
  updateUserSchema,
  userSchema,
} from '@stockpro/shared';
import { createUserService } from './service';

export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requirePermission('users'));
  const service = createUserService(app.db);
  const tags = ['users'];

  app.get(
    '/',
    {
      schema: { tags, querystring: listUsersQuerySchema, response: { 200: paginated(userSchema) } },
    },
    async (req) => service.list(req.auth, req.query),
  );

  app.get(
    '/:id',
    { schema: { tags, params: idParamsSchema, response: { 200: userSchema } } },
    async (req) => service.get(req.auth, req.params.id),
  );

  app.post(
    '/',
    { schema: { tags, body: createUserSchema, response: { 201: userSchema } } },
    async (req, reply) => reply.status(201).send(await service.create(req.auth, req.body)),
  );

  app.put(
    '/:id',
    {
      schema: {
        tags,
        params: idParamsSchema,
        body: updateUserSchema,
        response: { 200: userSchema },
      },
    },
    async (req) => service.update(req.auth, req.params.id, req.body),
  );

  app.delete(
    '/:id',
    { schema: { tags, params: idParamsSchema, response: { 204: z.null() } } },
    async (req, reply) => {
      await service.remove(req.auth, req.params.id);
      return reply.status(204).send(null);
    },
  );
};
