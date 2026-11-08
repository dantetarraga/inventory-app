import { sql } from 'drizzle-orm';
import { products, stock } from '../../db/schema';

export const totalStockSql = sql<string>`coalesce((select sum(${stock.quantity}) from ${stock} where ${stock.productId} = ${products.id}), 0)`;

export const isLowStockSql = sql<boolean>`(${totalStockSql} <= ${products.minStock})`;

export const totalStockColumn = sql<string>`${totalStockSql}::numeric(14,3)`;
