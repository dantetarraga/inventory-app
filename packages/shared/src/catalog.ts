import { z } from 'zod';
import { paginationQuerySchema } from './common';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hexadecimal inválido');

export const categorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string(),
  productCount: z.number().int(),
});
export type Category = z.infer<typeof categorySchema>;
export const upsertCategorySchema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(80),
  color: hexColor.default('#64748b'),
});
export type UpsertCategoryInput = z.input<typeof upsertCategorySchema>;

export const brandSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  productCount: z.number().int(),
});
export type Brand = z.infer<typeof brandSchema>;
export const upsertBrandSchema = z.object({ name: z.string().trim().min(1, 'Requerido').max(80) });
export type UpsertBrandInput = z.input<typeof upsertBrandSchema>;

export const warehouseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  address: z.string().nullable(),
  isDefault: z.boolean(),
});
export type Warehouse = z.infer<typeof warehouseSchema>;
export const upsertWarehouseSchema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(80),
  address: z.string().trim().max(200).nullable().optional(),
});
export type UpsertWarehouseInput = z.input<typeof upsertWarehouseSchema>;

export const listCatalogQuerySchema = paginationQuerySchema;
