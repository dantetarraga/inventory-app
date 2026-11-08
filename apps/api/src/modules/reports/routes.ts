import { and, asc, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  idParamsSchema,
  kardexReportQuerySchema,
  kardexReportRowSchema,
  MOVEMENT_TYPE_LABELS,
  productStockReportSchema,
  reportFormatQuerySchema,
  stockReportRowSchema,
  valuationReportSchema,
} from '@stockpro/shared';
import {
  brands,
  categories,
  kardexMovements,
  products,
  stock,
  users,
  warehouses,
} from '../../db/schema';
import { AppError } from '../../lib/errors';
import { sendXlsx } from '../../lib/xlsx';
import { isLowStockSql, totalStockSql } from '../products/service';

const MAX_KARDEX_ROWS = 10_000;

export const reportRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requirePermission('reports'));
  const { db } = app;
  const tags = ['reports'];

  const stockColumns = {
    productId: products.id,
    name: products.name,
    category: categories.name,
    brand: brands.name,
    stock: sql<string>`${totalStockSql}::numeric(14,3)`,
    minStock: products.minStock,
  };
  const stockQuery = (companyId: number, ...extra: Parameters<typeof and>) =>
    db
      .select(stockColumns)
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(brands, eq(brands.id, products.brandId))
      .where(and(eq(products.companyId, companyId), isNull(products.deletedAt), ...extra))
      .orderBy(asc(products.name));

  const stockXlsxColumns = [
    { header: 'Producto', key: 'name', width: 40 },
    { header: 'Categoría', key: 'category' },
    { header: 'Marca', key: 'brand' },
    { header: 'Stock', key: 'stock', numeric: true },
    { header: 'Stock mínimo', key: 'minStock', numeric: true },
  ] as const;

  app.get(
    '/stock',
    {
      schema: {
        tags,
        querystring: reportFormatQuerySchema,
        response: { 200: z.array(stockReportRowSchema) },
      },
    },
    async (req, reply) => {
      const rows = await stockQuery(req.auth.companyId);
      if (req.query.format === 'xlsx') {
        return sendXlsx(reply, {
          filename: 'stock-actual',
          sheet: 'Stock',
          title: 'Stock actual',
          columns: [...stockXlsxColumns],
          rows,
        });
      }
      return rows;
    },
  );

  app.get(
    '/low-stock',
    {
      schema: {
        tags,
        querystring: reportFormatQuerySchema,
        response: { 200: z.array(stockReportRowSchema) },
      },
    },
    async (req, reply) => {
      const rows = await stockQuery(req.auth.companyId, isLowStockSql);
      if (req.query.format === 'xlsx') {
        return sendXlsx(reply, {
          filename: 'stock-bajo-minimo',
          sheet: 'Bajo mínimo',
          title: 'Stock bajo mínimo',
          columns: [...stockXlsxColumns],
          rows,
        });
      }
      return rows;
    },
  );

  app.get(
    '/stock/:id',
    { schema: { tags, params: idParamsSchema, response: { 200: productStockReportSchema } } },
    async (req) => {
      const [product] = await stockQuery(req.auth.companyId, eq(products.id, req.params.id));
      if (!product) throw AppError.notFound('Producto');
      const byWarehouse = await db
        .select({
          warehouseId: warehouses.id,
          warehouse: warehouses.name,
          stock: sql<string>`coalesce(${stock.quantity}, 0)::numeric(14,3)`,
        })
        .from(warehouses)
        .leftJoin(
          stock,
          and(eq(stock.warehouseId, warehouses.id), eq(stock.productId, product.productId)),
        )
        .where(eq(warehouses.companyId, req.auth.companyId))
        .orderBy(desc(warehouses.isDefault), asc(warehouses.name));
      return { product, warehouses: byWarehouse };
    },
  );

  app.get(
    '/valuation',
    {
      schema: {
        tags,
        querystring: reportFormatQuerySchema,
        response: { 200: valuationReportSchema },
      },
    },
    async (req, reply) => {
      const rows = await db
        .select({
          productId: products.id,
          name: products.name,
          stock: sql<string>`${totalStockSql}::numeric(14,3)`,
          purchasePrice: products.purchasePrice,
          total: sql<string>`round(${totalStockSql} * ${products.purchasePrice}, 2)::numeric(16,2)`,
        })
        .from(products)
        .where(and(eq(products.companyId, req.auth.companyId), isNull(products.deletedAt)))
        .orderBy(asc(products.name));
      if (req.query.format === 'xlsx') {
        return sendXlsx(reply, {
          filename: 'inventario-valorado',
          sheet: 'Valorizado',
          title: 'Inventario valorado',
          columns: [
            { header: 'Producto', key: 'name', width: 40 },
            { header: 'Stock', key: 'stock', numeric: true },
            { header: 'Precio compra', key: 'purchasePrice', numeric: true },
            { header: 'Total', key: 'total', numeric: true },
          ],
          rows,
        });
      }
      const [sum] = await db
        .execute<{ total: string }>(
          sql`select coalesce(sum(round(${totalStockSql} * ${products.purchasePrice}, 2)), 0)::numeric(16,2)::text as total
            from ${products} where ${products.companyId} = ${req.auth.companyId} and ${products.deletedAt} is null`,
        )
        .then((r) => r.rows);
      return { rows, grandTotal: sum?.total ?? '0.00' };
    },
  );

  app.get(
    '/kardex',
    {
      schema: {
        tags,
        querystring: kardexReportQuerySchema,
        response: { 200: z.array(kardexReportRowSchema) },
      },
    },
    async (req, reply) => {
      const q = req.query;
      const rows = await db
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
            eq(kardexMovements.companyId, req.auth.companyId),
            q.productId ? eq(kardexMovements.productId, q.productId) : undefined,
            q.from ? gte(kardexMovements.occurredAt, sql`${q.from}::date`) : undefined,
            q.to ? lt(kardexMovements.occurredAt, sql`${q.to}::date + 1`) : undefined,
          ),
        )
        .orderBy(desc(kardexMovements.occurredAt), desc(kardexMovements.id))
        .limit(MAX_KARDEX_ROWS);
      const dto = rows.map((r) => ({ ...r, occurredAt: r.occurredAt.toISOString() }));
      if (q.format === 'xlsx') {
        return sendXlsx(reply, {
          filename: 'kardex',
          sheet: 'Kardex',
          title: 'Kardex entradas y salidas',
          columns: [
            { header: 'Fecha', key: 'occurredAt', width: 22 },
            { header: 'Producto', key: 'product', width: 36 },
            { header: 'Almacén', key: 'warehouse' },
            { header: 'Tipo', key: 'type', width: 12 },
            { header: 'Cantidad', key: 'delta', numeric: true },
            { header: 'Saldo', key: 'balanceAfter', numeric: true },
            { header: 'Usuario', key: 'user', width: 24 },
            { header: 'Detalle', key: 'note', width: 36 },
          ],
          rows: dto.map((r) => ({ ...r, type: MOVEMENT_TYPE_LABELS[r.type] })),
        });
      }
      return dto;
    },
  );
};
