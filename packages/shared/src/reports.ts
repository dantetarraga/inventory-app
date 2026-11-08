import { z } from 'zod';
import { MOVEMENT_TYPES } from './modules';

export const stockReportRowSchema = z.object({
  productId: z.number().int(),
  name: z.string(),
  category: z.string().nullable(),
  brand: z.string().nullable(),
  stock: z.string(),
  minStock: z.string(),
});
export type StockReportRow = z.infer<typeof stockReportRowSchema>;

export const productStockReportSchema = z.object({
  product: stockReportRowSchema,
  warehouses: z.array(
    z.object({ warehouseId: z.number().int(), warehouse: z.string(), stock: z.string() }),
  ),
});
export type ProductStockReport = z.infer<typeof productStockReportSchema>;

export const valuationRowSchema = z.object({
  productId: z.number().int(),
  name: z.string(),
  stock: z.string(),
  purchasePrice: z.string(),
  total: z.string(),
});
export const valuationReportSchema = z.object({
  rows: z.array(valuationRowSchema),
  grandTotal: z.string(),
});
export type ValuationReport = z.infer<typeof valuationReportSchema>;

export const kardexReportRowSchema = z.object({
  id: z.number().int(),
  occurredAt: z.string(),
  product: z.string(),
  warehouse: z.string(),
  type: z.enum(MOVEMENT_TYPES),
  delta: z.string(),
  balanceAfter: z.string(),
  user: z.string(),
  note: z.string().nullable(),
});
export type KardexReportRow = z.infer<typeof kardexReportRowSchema>;

export const reportFormatQuerySchema = z.object({
  format: z.enum(['json', 'xlsx']).default('json'),
});
export const kardexReportQuerySchema = reportFormatQuerySchema.extend({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  productId: z.coerce.number().int().positive().optional(),
});

export const dashboardSummarySchema = z.object({
  totals: z.object({
    products: z.number().int(),
    lowStock: z.number().int(),
    inventoryValue: z.string(),
    movementsThisMonth: z.number().int(),
  }),
  monthly: z.array(z.object({ month: z.string(), in: z.string(), out: z.string() })),
  byCategory: z.array(z.object({ category: z.string(), color: z.string(), stock: z.string() })),
  topProducts: z.array(z.object({ name: z.string(), out: z.string() })),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
