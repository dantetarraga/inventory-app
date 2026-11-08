import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  idParamsSchema,
  listCatalogQuerySchema,
  paginated,
  upsertWarehouseSchema,
  warehouseSchema,
} from '@stockpro/shared';
import { kardexMovements, stock, warehouses } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { likePattern, pageOffset } from '../../lib/pagination';

export const warehouseRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  const { db } = app;
  const tags = ['warehouses'];
  const canWrite = app.requirePermission('warehouses');

  const columns = {
    id: warehouses.id,
    name: warehouses.name,
    address: warehouses.address,
    isDefault: warehouses.isDefault,
  };
  const byId = (companyId: number, id: number) =>
    and(eq(warehouses.id, id), eq(warehouses.companyId, companyId));

  const getOne = async (companyId: number, id: number) => {
    const [row] = await db.select(columns).from(warehouses).where(byId(companyId, id));
    if (!row) throw AppError.notFound('Almacén');
    return row;
  };

  app.get(
    '/',
    {
      schema: {
        tags,
        querystring: listCatalogQuerySchema,
        response: { 200: paginated(warehouseSchema) },
      },
    },
    async (req) => {
      const { q, page, pageSize } = req.query;
      const where = and(
        eq(warehouses.companyId, req.auth.companyId),
        q ? ilike(warehouses.name, likePattern(q)) : undefined,
      );
      const { limit, offset } = pageOffset({ page, pageSize });
      const [items, [total]] = await Promise.all([
        db
          .select(columns)
          .from(warehouses)
          .where(where)
          .orderBy(desc(warehouses.isDefault), asc(warehouses.name))
          .limit(limit)
          .offset(offset),
        db.select({ value: count() }).from(warehouses).where(where),
      ]);
      return { items, total: total?.value ?? 0, page, pageSize };
    },
  );

  app.post(
    '/',
    {
      onRequest: canWrite,
      schema: { tags, body: upsertWarehouseSchema, response: { 201: warehouseSchema } },
    },
    async (req, reply) => {
      const id = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(warehouses)
          .values({ ...req.body, companyId: req.auth.companyId })
          .returning({ id: warehouses.id });
        await audit(tx, req.auth, {
          entity: 'warehouse',
          entityId: row!.id,
          action: 'create',
          data: req.body,
        });
        return row!.id;
      });
      return reply.status(201).send(await getOne(req.auth.companyId, id));
    },
  );

  app.put(
    '/:id',
    {
      onRequest: canWrite,
      schema: {
        tags,
        params: idParamsSchema,
        body: upsertWarehouseSchema,
        response: { 200: warehouseSchema },
      },
    },
    async (req) => {
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(warehouses)
          .set(req.body)
          .where(byId(req.auth.companyId, req.params.id))
          .returning({ id: warehouses.id });
        if (updated.length === 0) throw AppError.notFound('Almacén');
        await audit(tx, req.auth, {
          entity: 'warehouse',
          entityId: req.params.id,
          action: 'update',
          data: req.body,
        });
      });
      return getOne(req.auth.companyId, req.params.id);
    },
  );

  app.post(
    '/:id/default',
    {
      onRequest: canWrite,
      schema: { tags, params: idParamsSchema, response: { 200: warehouseSchema } },
    },
    async (req) => {
      await db.transaction(async (tx) => {
        await getOne(req.auth.companyId, req.params.id);
        await tx
          .update(warehouses)
          .set({ isDefault: false })
          .where(and(eq(warehouses.companyId, req.auth.companyId), eq(warehouses.isDefault, true)));
        await tx
          .update(warehouses)
          .set({ isDefault: true })
          .where(byId(req.auth.companyId, req.params.id));
        await audit(tx, req.auth, {
          entity: 'warehouse',
          entityId: req.params.id,
          action: 'set_default',
        });
      });
      return getOne(req.auth.companyId, req.params.id);
    },
  );

  app.delete(
    '/:id',
    { onRequest: canWrite, schema: { tags, params: idParamsSchema, response: { 204: z.null() } } },
    async (req, reply) => {
      await db.transaction(async (tx) => {
        const wh = await getOne(req.auth.companyId, req.params.id);
        if (wh.isDefault) throw AppError.conflict('No se puede eliminar el almacén predeterminado');
        const [used] = await tx
          .select({ value: count() })
          .from(kardexMovements)
          .where(eq(kardexMovements.warehouseId, wh.id));
        if ((used?.value ?? 0) > 0) {
          throw AppError.conflict('No se puede eliminar: el almacén tiene movimientos registrados');
        }
        await tx.delete(stock).where(eq(stock.warehouseId, wh.id));
        await tx.delete(warehouses).where(byId(req.auth.companyId, wh.id));
        await audit(tx, req.auth, { entity: 'warehouse', entityId: wh.id, action: 'delete' });
      });
      return reply.status(204).send(null);
    },
  );
};
