import { sql } from 'drizzle-orm';
import type { DashboardSummary } from '@stockpro/shared';
import type { Database } from '../../db/client';
import { categories, kardexMovements, products, stock } from '../../db/schema';

export function createDashboardRepository(db: Database) {
  const productStock = (
    cid: number,
  ) => sql`(select p.id, p.name, p.category_id, p.min_stock, p.purchase_price,
      coalesce((select sum(s.quantity) from ${stock} s where s.product_id = p.id), 0) as qty
    from ${products} p where p.company_id = ${cid} and p.deleted_at is null)`;

  return {
    async totals(cid: number): Promise<DashboardSummary['totals']> {
      const { rows } = await db.execute<DashboardSummary['totals']>(sql`select
        (select count(*)::int from ${productStock(cid)} ps) as "products",
        (select count(*)::int from ${productStock(cid)} ps where ps.qty <= ps.min_stock) as "lowStock",
        (select coalesce(sum(round(ps.qty * ps.purchase_price, 2)), 0)::numeric(16,2)::text
           from ${productStock(cid)} ps) as "inventoryValue",
        (select count(*)::int from ${kardexMovements} k
           where k.company_id = ${cid} and k.occurred_at >= date_trunc('month', now())) as "movementsThisMonth"`);
      return rows[0]!;
    },

    async monthly(cid: number): Promise<DashboardSummary['monthly']> {
      const { rows } = await db.execute<DashboardSummary['monthly'][number]>(sql`
        select to_char(m.month, 'YYYY-MM') as month,
          coalesce(sum(k.delta) filter (where k.delta > 0), 0)::numeric(14,3)::text as "in",
          coalesce(-sum(k.delta) filter (where k.delta < 0), 0)::numeric(14,3)::text as "out"
        from generate_series(date_trunc('month', now()) - interval '5 months',
                             date_trunc('month', now()), interval '1 month') as m(month)
        left join ${kardexMovements} k
          on k.company_id = ${cid} and date_trunc('month', k.occurred_at) = m.month
        group by m.month order by m.month`);
      return rows;
    },

    async stockByCategory(cid: number, limit = 8): Promise<DashboardSummary['byCategory']> {
      const { rows } = await db.execute<DashboardSummary['byCategory'][number]>(sql`
        select coalesce(c.name, 'Sin categoría') as category,
          coalesce(c.color, '#94a3b8') as color,
          sum(ps.qty)::numeric(14,3)::text as stock
        from ${productStock(cid)} ps left join ${categories} c on c.id = ps.category_id
        group by c.name, c.color having sum(ps.qty) > 0
        order by sum(ps.qty) desc limit ${limit}`);
      return rows;
    },

    async topOutputs(cid: number, days = 30, limit = 5): Promise<DashboardSummary['topProducts']> {
      const { rows } = await db.execute<DashboardSummary['topProducts'][number]>(sql`
        select p.name, (-sum(k.delta))::numeric(14,3)::text as out
        from ${kardexMovements} k join ${products} p on p.id = k.product_id
        where k.company_id = ${cid} and k.type = 'out'
          and k.occurred_at >= now() - make_interval(days => ${days})
        group by p.name order by sum(k.delta) asc limit ${limit}`);
      return rows;
    },
  };
}
