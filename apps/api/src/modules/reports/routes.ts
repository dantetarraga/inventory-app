import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  dates,
  idParamsSchema,
  kardexReportQuerySchema,
  kardexReportRowSchema,
  MOVEMENT_TYPE_LABELS,
  productStockReportSchema,
  reportFormatQuerySchema,
  stockReportRowSchema,
  valuationReportSchema,
} from '@stockpro/shared';
import { sendXlsx, type XlsxColumn } from '../../lib/xlsx';
import { createReportService } from './service';

const stockXlsxColumns = [
  { header: 'Producto', key: 'name', width: 40 },
  { header: 'Categoría', key: 'category' },
  { header: 'Marca', key: 'brand' },
  { header: 'Stock', key: 'stock', numeric: true },
  { header: 'Stock mínimo', key: 'minStock', numeric: true },
] satisfies XlsxColumn<z.infer<typeof stockReportRowSchema>>[];

export const reportRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  app.addHook('onRequest', app.requirePermission('reports'));
  const service = createReportService(app.db);
  const tags = ['reports'];

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
      const rows = await service.stock(req.auth);
      if (req.query.format !== 'xlsx') return rows;
      return sendXlsx(reply, {
        filename: 'stock-actual',
        sheet: 'Stock',
        title: 'Stock actual',
        columns: stockXlsxColumns,
        rows,
      });
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
      const rows = await service.lowStock(req.auth);
      if (req.query.format !== 'xlsx') return rows;
      return sendXlsx(reply, {
        filename: 'stock-bajo-minimo',
        sheet: 'Bajo mínimo',
        title: 'Stock bajo mínimo',
        columns: stockXlsxColumns,
        rows,
      });
    },
  );

  app.get(
    '/stock/:id',
    { schema: { tags, params: idParamsSchema, response: { 200: productStockReportSchema } } },
    async (req) => service.productStock(req.auth, req.params.id),
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
      const report = await service.valuation(req.auth);
      if (req.query.format !== 'xlsx') return report;
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
        rows: report.rows,
      });
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
      const { format, ...filter } = req.query;
      const rows = await service.kardex(req.auth, filter);
      if (format !== 'xlsx') return rows;
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
        rows: rows.map((r) => ({
          ...r,
          occurredAt: dates.format(r.occurredAt, 'dateTime'),
          type: MOVEMENT_TYPE_LABELS[r.type],
        })),
      });
    },
  );
};
