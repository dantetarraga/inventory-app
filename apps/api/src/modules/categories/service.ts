import type { z } from 'zod';
import type { Category, upsertCategorySchema } from '@stockpro/shared';
import type { Database } from '../../db/client';
import { categories, products } from '../../db/schema';
import { createNamedCatalogService } from '../catalog/service';

export function createCategoryService(db: Database) {
  return createNamedCatalogService<Category, z.output<typeof upsertCategorySchema>>(db, {
    table: categories,
    productFk: products.categoryId,
    entity: 'category',
    label: 'Categoría',
    inUseMessage: 'No se puede eliminar: hay productos con esta categoría',
    extraColumns: { color: categories.color },
  });
}
