import { z } from 'zod';
import { MOVEMENT_TYPES } from './modules';
import { decimalString, paginationQuerySchema } from './common';

export const movementSchema = z.object({
  id: z.number().int(),
  type: z.enum(MOVEMENT_TYPES),
  /** Signed delta applied to stock. */
  delta: z.string(),
  balanceAfter: z.string(),
  unitCost: z.string().nullable(),
  note: z.string().nullable(),
  occurredAt: z.string(),
  product: z.object({ id: z.number().int(), name: z.string() }),
  warehouse: z.object({ id: z.number().int(), name: z.string() }),
  user: z.object({ id: z.number().int(), fullName: z.string() }),
});
export type Movement = z.infer<typeof movementSchema>;

export const createMovementSchema = z
  .object({
    type: z.enum(MOVEMENT_TYPES),
    productId: z.number().int().positive(),
    /** Defaults to the company's default warehouse. */
    warehouseId: z.number().int().positive().optional(),
    /** "in"/"out": quantity moved (> 0). "adjust": the new counted stock (>= 0). */
    quantity: decimalString(3),
    unitCost: decimalString(2).nullable().optional(),
    note: z.string().trim().max(300).nullable().optional(),
  })
  .refine((v) => v.type === 'adjust' || Number(v.quantity) > 0, {
    path: ['quantity'],
    message: 'Debe ser mayor que 0',
  });
export type CreateMovementInput = z.input<typeof createMovementSchema>;

export const listMovementsQuerySchema = paginationQuerySchema.extend({
  productId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
  type: z.enum(MOVEMENT_TYPES).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type ListMovementsQuery = z.input<typeof listMovementsQuerySchema>;
