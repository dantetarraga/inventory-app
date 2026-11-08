import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ModuleCode } from '@stockpro/shared';
import { idParamsSchema, listCatalogQuerySchema, paginated } from '@stockpro/shared';
import type { NamedCatalogService } from './service';

export function namedCatalogRoutes<TRow, TInput extends { name: string }>(opts: {
  module: ModuleCode;
  rowSchema: z.ZodType<TRow>;
  inputSchema: z.ZodType<TInput>;
  createService: (app: Parameters<FastifyPluginAsyncZod>[0]) => NamedCatalogService<TRow, TInput>;
}): FastifyPluginAsyncZod {
  return async (app) => {
    app.addHook('onRequest', app.authenticate);
    const service = opts.createService(app);
    const canWrite = app.requirePermission(opts.module);
    const tags = [opts.module];

    app.get(
      '/',
      {
        schema: {
          tags,
          querystring: listCatalogQuerySchema,
          response: { 200: paginated(opts.rowSchema) },
        },
      },
      async (req) => service.list(req.auth, req.query),
    );

    app.post(
      '/',
      {
        onRequest: canWrite,
        schema: { tags, body: opts.inputSchema, response: { 201: opts.rowSchema } },
      },
      async (req, reply) =>
        reply.status(201).send(await service.create(req.auth, req.body as TInput)),
    );

    app.put(
      '/:id',
      {
        onRequest: canWrite,
        schema: {
          tags,
          params: idParamsSchema,
          body: opts.inputSchema,
          response: { 200: opts.rowSchema },
        },
      },
      async (req) => service.update(req.auth, req.params.id, req.body as TInput),
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
}
