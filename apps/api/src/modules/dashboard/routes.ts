import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { dashboardSummarySchema } from '@stockpro/shared';
import { createDashboardService } from './service';

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  const service = createDashboardService(app.db);

  app.get(
    '/summary',
    { schema: { tags: ['dashboard'], response: { 200: dashboardSummarySchema } } },
    async (req) => service.summary(req.auth),
  );
};
