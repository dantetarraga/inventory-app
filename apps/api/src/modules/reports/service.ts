import type {
  KardexReportRow,
  ProductStockReport,
  StockReportRow,
  ValuationReport,
} from '@stockpro/shared';
import type { Database } from '../../db/client';
import { AppError } from '../../lib/errors';
import type { AuthContext } from '../../plugins/auth';
import { createReportRepository, type KardexFilter } from './repository';
import { dates } from '@stockpro/shared';

export function createReportService(db: Database) {
  const repo = createReportRepository(db);

  return {
    stock: (ctx: AuthContext): Promise<StockReportRow[]> => repo.stockRows(ctx.companyId),

    lowStock: (ctx: AuthContext): Promise<StockReportRow[]> => repo.lowStockRows(ctx.companyId),

    async productStock(ctx: AuthContext, productId: number): Promise<ProductStockReport> {
      const product = await repo.productStockRow(ctx.companyId, productId);
      if (!product) throw AppError.notFound('Producto');
      const warehouses = await repo.stockByWarehouse(ctx.companyId, product.productId);
      return { product, warehouses };
    },

    async valuation(ctx: AuthContext): Promise<ValuationReport> {
      const [rows, grandTotal] = await Promise.all([
        repo.valuationRows(ctx.companyId),
        repo.valuationTotal(ctx.companyId),
      ]);
      return { rows, grandTotal };
    },

    async kardex(ctx: AuthContext, filter: KardexFilter): Promise<KardexReportRow[]> {
      const rows = await repo.kardexRows(ctx.companyId, filter);
      return rows.map((r) => ({ ...r, occurredAt: dates.toISO(r.occurredAt) }));
    },
  };
}
