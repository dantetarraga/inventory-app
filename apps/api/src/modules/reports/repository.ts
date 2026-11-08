import { and, asc, desc, eq, gte, isNull, lt, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../db/client';
import {
  brands,
  categories,
  kardexMovements,
  products,
  stock,
  users,
  warehouses,
} from '../../db/schema';
import { isLowStockSql, totalStockColumn, totalStockSql } from '../products/repository';

export const MAX_KARDEX_ROWS = 10_000;

export interface KardexFilter {
  productId?: number;
  from?: string;
  to?: string;
}

export function createReportRepository(db: Database) {
  const activeProducts = (companyId: number) =>
    and(eq(products.companyId, companyId), isNull(products.deletedAt));

  function stockRows(companyId: number, extra?: SQL) {
    return db
      .select({
        productId: products.id,
        name: products.name,
        category: categories.name,
        brand: brands.name,
        stock: totalStockColumn,
        minStock: products.minStock,
      })
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(and(activeProducts(companyId), extra))
      .orderBy(asc(products.name));
  }

  return {
    stockRows,

    lowStockRows: (companyId: number) => stockRows(companyId, isLowStockSql),

    productStockRow: async (companyId: number, productId: number) =>
      (await stockRows(companyId, eq(products.id, productId)))[0],

    stockByWarehouse: (companyId: number, productId: number) =>
      db
        .select({
          warehouseId: warehouses.id,
          warehouse: warehouses.name,
          stock: sql<string>`coalesce(${stock.quantity}, 0)::numeric(14,3)`,
        })
        .from(warehouses)
        .leftJoin(stock, and(eq(stock.warehouseId, warehouses.id), eq(stock.productId, productId)))
        .where(eq(warehouses.companyId, companyId))
        .orderBy(desc(warehouses.isDefault), asc(warehouses.name)),

    valuationRows: (companyId: number) =>
      db
        .select({
          productId: products.id,
          name: products.name,
          stock: totalStockColumn,
          purchasePrice: products.purchasePrice,
          total: sql<string>`round(${totalStockSql} * ${products.purchasePrice}, 2)::numeric(16,2)`,
        })
        .from(products)
        .where(activeProducts(companyId))
        .orderBy(asc(products.name)),

    valuationTotal: async (companyId: number) => {
      const { rows } = await db.execute<{ total: string }>(
        sql`select coalesce(sum(round(${totalStockSql} * ${products.purchasePrice}, 2)), 0)::numeric(16,2)::text as total
            from ${products} where ${products.companyId} = ${companyId} and ${products.deletedAt} is null`,
      );
      return rows[0]?.total ?? '0.00';
    },

    kardexRows: (companyId: number, f: KardexFilter) =>
      db
        .select({
          id: kardexMovements.id,
          occurredAt: kardexMovements.occurredAt,
          product: products.name,
          warehouse: warehouses.name,
          type: kardexMovements.type,
          delta: kardexMovements.delta,
          balanceAfter: kardexMovements.balanceAfter,
          user: users.fullName,
          note: kardexMovements.note,
        })
        .from(kardexMovements)
        .innerJoin(products, eq(products.id, kardexMovements.productId))
        .innerJoin(warehouses, eq(warehouses.id, kardexMovements.warehouseId))
        .innerJoin(users, eq(users.id, kardexMovements.userId))
        .where(
          and(
            eq(kardexMovements.companyId, companyId),
            f.productId ? eq(kardexMovements.productId, f.productId) : undefined,
            f.from ? gte(kardexMovements.occurredAt, sql`${f.from}::date`) : undefined,
            f.to ? lt(kardexMovements.occurredAt, sql`${f.to}::date + 1`) : undefined,
          ),
        )
        .orderBy(desc(kardexMovements.occurredAt), desc(kardexMovements.id))
        .limit(MAX_KARDEX_ROWS),
  };
}
