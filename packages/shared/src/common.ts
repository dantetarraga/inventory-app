import { z } from 'zod';

export const idSchema = z.coerce.number().int().positive();
export const idParamsSchema = z.object({ id: idSchema });

/**
 * Decimal values travel as strings to avoid floating point loss (Postgres `numeric`).
 * Accepts numbers too (handy for forms) and normalizes to a string.
 */
export const decimalString = (scale: number) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => new RegExp(`^\\d+(\\.\\d{1,${scale}})?$`).test(v), {
      message: `Debe ser un número positivo con hasta ${scale} decimales`,
    });

export const positiveDecimal = (scale: number) =>
  decimalString(scale).refine((v) => Number(v) > 0, { message: 'Debe ser mayor que 0' });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });
export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

/** RFC 7807 problem details. */
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type Problem = z.infer<typeof problemSchema>;
