import { categorySchema, upsertCategorySchema } from '@stockpro/shared';
import { namedCatalogRoutes } from '../catalog/routes';
import { createCategoryService } from './service';

export const categoryRoutes = namedCatalogRoutes({
  module: 'categories',
  rowSchema: categorySchema,
  inputSchema: upsertCategorySchema,
  createService: (app) => createCategoryService(app.db),
});
