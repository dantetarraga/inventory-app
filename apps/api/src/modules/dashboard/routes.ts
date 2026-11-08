import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { dashboardSummarySchema } from '@stockpro/shared';
import { categories, kardexMovements, products, stock } from '../../db/schema';

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', app.authenticate);
  const { db } = app;

  app.get(
    '/summary',
    { schema: { tags: ['dashboard'], response: { 200: dashboardSummarySchema } } },
    async (req) => {
      const cid = req.auth.companyId;
      const productStock = sql`(select p.id, p.name, p.category_id, p.min_stock, p.purchase_price,
          coalesce((select sum(s.quantity) from ${stock} s where s.product_id = p.id), 0) as qty
        from ${products} p where p.company_id = ${cid} and p.deleted_at is null)`;

      const [totals, monthly, byCategory, topProducts] = await Promise.all([
        db
          .execute<{
            products: number;
            lowStock: number;
            inventoryValue: string;
            movementsThisMonth: number;
          }>(
            sql`select
              (select count(*)::int from ${productStock} ps) as "products",
              (select count(*)::int from ${productStock} ps where ps.qty <= ps.min_stock) as "lowStock",
              (select coalesce(sum(round(ps.qty * ps.purchase_price, 2)), 0)::numeric(16,2)::text from ${productStock} ps) as "inventoryValue",
              (select count(*)::int from ${kardexMovements} k
                 where k.company_id = ${cid} and k.occurred_at >= date_trunc('month', now())) as "movementsThisMonth"`,
          )
          .then((r) => r.rows[0]!),
        db
          .execute<{ month: string; in: string; out: string }>(
            sql`select to_char(m.month, 'YYYY-MM') as month,
                  coalesce(sum(k.delta) filter (where k.delta > 0), 0)::numeric(14,3)::text as "in",
                  coalesce(-sum(k.delta) filter (where k.delta < 0), 0)::numeric(14,3)::text as "out"
                from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as m(month)
                left join ${kardexMovements} k
                  on k.company_id = ${cid} and date_trunc('month', k.occurred_at) = m.month
                group by m.month order by m.month`,
          )
          .then((r) => r.rows),
        db
          .execute<{ category: string; color: string; stock: string }>(
            sql`select coalesce(c.name, 'Sin categoría') as category,
                  coalesce(c.color, '#94a3b8') as color,
                  sum(ps.qty)::numeric(14,3)::text as stock
                from ${productStock} ps left join ${categories} c on c.id = ps.category_id
                group by c.name, c.color having sum(ps.qty) > 0
                order by sum(ps.qty) desc limit 8`,
          )
          .then((r) => r.rows),
        db
          .execute<{ name: string; out: string }>(
            sql`select p.name, (-sum(k.delta))::numeric(14,3)::text as out
                from ${kardexMovements} k join ${products} p on p.id = k.product_id
                where k.company_id = ${cid} and k.type = 'out' and k.occurred_at >= now() - interval '30 days'
                group by p.name order by sum(k.delta) asc limit 5`,
          )
          .then((r) => r.rows),
      ]);

      return { totals, monthly, byCategory, topProducts };
    },
  );
};
