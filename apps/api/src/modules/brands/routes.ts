import { and, asc, count, eq, ilike, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  brandSchema,
  idParamsSchema,
  listCatalogQuerySchema,
  paginated,
  upsertBrandSchema,
} from '@stockpro/shared';
import { brands, products } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { likePattern, pageOffset } from '../../lib/pagination';

export const brandRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  const { db } = app;
  const tags = ['brands'];
  const canWrite = app.requirePermission('brands');

  const productCount = sql<number>`(select count(*)::int from ${products}
    where ${products.brandId} = ${brands.id} and ${products.deletedAt} is null)`;
  const columns = { id: brands.id, name: brands.name, productCount };
  const byId = (companyId: number, id: number) =>
    and(eq(brands.id, id), eq(brands.companyId, companyId));

  const getOne = async (companyId: number, id: number) => {
    const [row] = await db.select(columns).from(brands).where(byId(companyId, id));
    if (!row) throw AppError.notFound('Marca');
    return row;
  };

  app.get(
    '/',
    {
      schema: {
        tags,
        querystring: listCatalogQuerySchema,
        response: { 200: paginated(brandSchema) },
      },
    },
    async (req) => {
      const { q, page, pageSize } = req.query;
      const where = and(
        eq(brands.companyId, req.auth.companyId),
        q ? ilike(brands.name, likePattern(q)) : undefined,
      );
      const { limit, offset } = pageOffset({ page, pageSize });
      const [items, [total]] = await Promise.all([
        db
          .select(columns)
          .from(brands)
          .where(where)
          .orderBy(asc(brands.name))
          .limit(limit)
          .offset(offset),
        db.select({ value: count() }).from(brands).where(where),
      ]);
      return { items, total: total?.value ?? 0, page, pageSize };
    },
  );

  app.post(
    '/',
    {
      onRequest: canWrite,
      schema: { tags, body: upsertBrandSchema, response: { 201: brandSchema } },
    },
    async (req, reply) => {
      const id = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(brands)
          .values({ ...req.body, companyId: req.auth.companyId })
          .returning({ id: brands.id });
        await audit(tx, req.auth, {
          entity: 'brand',
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
        body: upsertBrandSchema,
        response: { 200: brandSchema },
      },
    },
    async (req) => {
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(brands)
          .set(req.body)
          .where(byId(req.auth.companyId, req.params.id))
          .returning({ id: brands.id });
        if (updated.length === 0) throw AppError.notFound('Marca');
        await audit(tx, req.auth, {
          entity: 'brand',
          entityId: req.params.id,
          action: 'update',
          data: req.body,
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
        const [inUse] = await tx
          .select({ value: count() })
          .from(products)
          .where(and(eq(products.brandId, req.params.id), isNull(products.deletedAt)));
        if ((inUse?.value ?? 0) > 0) {
          throw AppError.conflict('No se puede eliminar: hay productos con esta marca');
        }
        const deleted = await tx
          .delete(brands)
          .where(byId(req.auth.companyId, req.params.id))
          .returning({ id: brands.id });
        if (deleted.length === 0) throw AppError.notFound('Marca');
        await audit(tx, req.auth, { entity: 'brand', entityId: req.params.id, action: 'delete' });
      });
      return reply.status(204).send(null);
    },
  );
};
