import type { z } from 'zod';
import type { Brand, upsertBrandSchema } from '@stockpro/shared';
import type { Database } from '../../db/client';
import { brands, products } from '../../db/schema';
import { createNamedCatalogService } from '../catalog/service';

export function createBrandService(db: Database) {
  return createNamedCatalogService<Brand, z.output<typeof upsertBrandSchema>>(db, {
    table: brands,
    productFk: products.brandId,
    entity: 'brand',
    label: 'Marca',
    inUseMessage: 'No se puede eliminar: hay productos con esta marca',
  });
}
