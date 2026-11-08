import { brandSchema, upsertBrandSchema } from '@stockpro/shared';
import { namedCatalogRoutes } from '../catalog/routes';
import { createBrandService } from './service';

export const brandRoutes = namedCatalogRoutes({
  module: 'brands',
  rowSchema: brandSchema,
  inputSchema: upsertBrandSchema,
  createService: (app) => createBrandService(app.db),
});
