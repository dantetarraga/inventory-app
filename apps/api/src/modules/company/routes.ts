import { eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { companySchema, companyStatsSchema, updateCompanySchema } from '@stockpro/shared';
import { brands, categories, companies, products, users, warehouses } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { audit } from '../../lib/audit';

export const companyRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  const { db } = app;

  const getCompany = async (companyId: number) => {
    const [row] = await db.select().from(companies).where(eq(companies.id, companyId));
    if (!row) throw AppError.notFound('Empresa');
    return {
      id: row.id,
      name: row.name,
      taxId: row.taxId,
      currency: row.currency,
      country: row.country,
      address: row.address,
      createdAt: row.createdAt.toISOString(),
    };
  };

  app.get('/', { schema: { tags: ['company'], response: { 200: companySchema } } }, async (req) =>
    getCompany(req.auth.companyId),
  );

  app.patch(
    '/',
    {
      onRequest: app.requirePermission('company'),
      schema: { tags: ['company'], body: updateCompanySchema, response: { 200: companySchema } },
    },
    async (req) => {
      await db.transaction(async (tx) => {
        await tx.update(companies).set(req.body).where(eq(companies.id, req.auth.companyId));
        await audit(tx, req.auth, {
          entity: 'company',
          entityId: req.auth.companyId,
          action: 'update',
          data: req.body,
        });
      });
      return getCompany(req.auth.companyId);
    },
  );

  app.get(
    '/stats',
    { schema: { tags: ['company'], response: { 200: companyStatsSchema } } },
    async (req) => {
      const cid = req.auth.companyId;
      const count = (table: typeof users | typeof categories | typeof brands | typeof warehouses) =>
        sql<number>`(select count(*)::int from ${table} where ${table.companyId} = ${cid})`;
      const [row] = await db
        .execute<{
          users: number;
          products: number;
          categories: number;
          brands: number;
          warehouses: number;
        }>(
          sql`select
        ${count(users)} as users,
        (select count(*)::int from ${products} where ${products.companyId} = ${cid} and ${products.deletedAt} is null) as products,
        ${count(categories)} as categories,
        ${count(brands)} as brands,
        ${count(warehouses)} as warehouses`,
        )
        .then((r) => r.rows);
      return row!;
    },
  );
};
