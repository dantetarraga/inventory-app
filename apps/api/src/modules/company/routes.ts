import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { companySchema, companyStatsSchema, updateCompanySchema } from '@stockpro/shared';
import { createCompanyService } from './service';

export const companyRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  const service = createCompanyService(app.db);
  const tags = ['company'];

  app.get('/', { schema: { tags, response: { 200: companySchema } } }, async (req) =>
    service.get(req.auth),
  );

  app.patch(
    '/',
    {
      onRequest: app.requirePermission('company'),
      schema: { tags, body: updateCompanySchema, response: { 200: companySchema } },
    },
    async (req) => service.update(req.auth, req.body),
  );

  app.get('/stats', { schema: { tags, response: { 200: companyStatsSchema } } }, async (req) =>
    service.stats(req.auth),
  );
};
