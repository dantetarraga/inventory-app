import { and, asc, count, eq, ilike, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  categorySchema,
  idParamsSchema,
  listCatalogQuerySchema,
  paginated,
  upsertCategorySchema,
} from '@stockpro/shared';
import { categories, products } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { likePattern, pageOffset } from '../../lib/pagination';

export const categoryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  const { db } = app;
  const tags = ['categories'];
  const canWrite = app.requirePermission('categories');

  const productCount = sql<number>`(select count(*)::int from ${products}
    where ${products.categoryId} = ${categories.id} and ${products.deletedAt} is null)`;
  const columns = {
    id: categories.id,
    name: categories.name,
    color: categories.color,
    productCount,
  };
  const byId = (companyId: number, id: number) =>
    and(eq(categories.id, id), eq(categories.companyId, companyId));

  const getOne = async (companyId: number, id: number) => {
    const [row] = await db.select(columns).from(categories).where(byId(companyId, id));
    if (!row) throw AppError.notFound('Categoría');
    return row;
  };

  app.get(
    '/',
    {
      schema: {
        tags,
        querystring: listCatalogQuerySchema,
        response: { 200: paginated(categorySchema) },
      },
    },
    async (req) => {
      const { q, page, pageSize } = req.query;
      const where = and(
        eq(categories.companyId, req.auth.companyId),
        q ? ilike(categories.name, likePattern(q)) : undefined,
      );
      const { limit, offset } = pageOffset({ page, pageSize });
      const [items, [total]] = await Promise.all([
        db
          .select(columns)
          .from(categories)
          .where(where)
          .orderBy(asc(categories.name))
          .limit(limit)
          .offset(offset),
        db.select({ value: count() }).from(categories).where(where),
      ]);
      return { items, total: total?.value ?? 0, page, pageSize };
    },
  );

  app.post(
    '/',
    {
      onRequest: canWrite,
      schema: { tags, body: upsertCategorySchema, response: { 201: categorySchema } },
    },
    async (req, reply) => {
      const id = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(categories)
          .values({ ...req.body, companyId: req.auth.companyId })
          .returning({ id: categories.id });
        await audit(tx, req.auth, {
          entity: 'category',
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
        body: upsertCategorySchema,
        response: { 200: categorySchema },
      },
    },
    async (req) => {
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(categories)
          .set(req.body)
          .where(byId(req.auth.companyId, req.params.id))
          .returning({ id: categories.id });
        if (updated.length === 0) throw AppError.notFound('Categoría');
        await audit(tx, req.auth, {
          entity: 'category',
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
          .where(and(eq(products.categoryId, req.params.id), isNull(products.deletedAt)));
        if ((inUse?.value ?? 0) > 0) {
          throw AppError.conflict('No se puede eliminar: hay productos con esta categoría');
        }
        const deleted = await tx
          .delete(categories)
          .where(byId(req.auth.companyId, req.params.id))
          .returning({ id: categories.id });
        if (deleted.length === 0) throw AppError.notFound('Categoría');
        await audit(tx, req.auth, {
          entity: 'category',
          entityId: req.params.id,
          action: 'delete',
        });
      });
      return reply.status(204).send(null);
    },
  );
};
