import { z } from 'zod';
import { decimalString, paginationQuerySchema } from './common';

export const productSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  barcode: z.string().nullable(),
  internalCode: z.string().nullable(),
  brand: z.object({ id: z.number().int(), name: z.string() }).nullable(),
  category: z.object({ id: z.number().int(), name: z.string(), color: z.string() }).nullable(),
  salePrice: z.string(),
  purchasePrice: z.string(),
  minStock: z.string(),
  /** Total stock across all warehouses (read-only; changes only through kardex). */
  stock: z.string(),
  isLowStock: z.boolean(),
  createdAt: z.string(),
});
export type Product = z.infer<typeof productSchema>;

const optionalCode = z.string().trim().max(64).nullable().optional();
const optionalId = z.number().int().positive().nullable().optional();

const productFields = {
  name: z.string().trim().min(1, 'Requerido').max(160),
  barcode: optionalCode,
  internalCode: optionalCode,
  brandId: optionalId,
  categoryId: optionalId,
  salePrice: decimalString(2),
  purchasePrice: decimalString(2),
  minStock: decimalString(3),
};

export const createProductSchema = z.object({
  ...productFields,
  /** Optional opening stock, registered as an "in" kardex movement. */
  initialStock: decimalString(3).optional(),
  warehouseId: z.number().int().positive().optional(),
});
export type CreateProductInput = z.input<typeof createProductSchema>;

export const updateProductSchema = z.object(productFields);
export type UpdateProductInput = z.input<typeof updateProductSchema>;

export const listProductsQuerySchema = paginationQuerySchema.extend({
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  lowStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ListProductsQuery = z.input<typeof listProductsQuerySchema>;
