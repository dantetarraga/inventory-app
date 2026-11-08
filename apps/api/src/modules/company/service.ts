import { eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Company, CompanyStats, updateCompanySchema } from '@stockpro/shared';
import type { Database } from '../../db/client';
import { brands, categories, companies, products, users, warehouses } from '../../db/schema';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import type { AuthContext } from '../../plugins/auth';
import { dates } from '@stockpro/shared';

export function createCompanyService(db: Database) {
  async function get(ctx: AuthContext): Promise<Company> {
    const [row] = await db.select().from(companies).where(eq(companies.id, ctx.companyId));
    if (!row) throw AppError.notFound('Empresa');
    return {
      id: row.id,
      name: row.name,
      taxId: row.taxId,
      currency: row.currency,
      country: row.country,
      address: row.address,
      createdAt: dates.toISO(row.createdAt),
    };
  }

  return {
    get,

    async update(ctx: AuthContext, input: z.output<typeof updateCompanySchema>): Promise<Company> {
      await db.transaction(async (tx) => {
        await tx.update(companies).set(input).where(eq(companies.id, ctx.companyId));
        await audit(tx, ctx, {
          entity: 'company',
          entityId: ctx.companyId,
          action: 'update',
          data: input,
        });
      });
      return get(ctx);
    },

    async stats(ctx: AuthContext): Promise<CompanyStats> {
      const cid = ctx.companyId;
      const countOf = (
        table: typeof users | typeof categories | typeof brands | typeof warehouses,
      ) => sql<number>`(select count(*)::int from ${table} where ${table.companyId} = ${cid})`;
      const { rows } = await db.execute<CompanyStats>(sql`select
        ${countOf(users)} as users,
        (select count(*)::int from ${products}
          where ${products.companyId} = ${cid} and ${products.deletedAt} is null) as products,
        ${countOf(categories)} as categories,
        ${countOf(brands)} as brands,
        ${countOf(warehouses)} as warehouses`);
      return rows[0]!;
    },
  };
}
