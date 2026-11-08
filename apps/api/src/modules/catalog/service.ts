import { and, asc, count, eq, ilike, isNull, sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { PaginationQuery, Paginated } from '@stockpro/shared';
import type { Database, DbOrTx } from '../../db/client';
import type { brands, categories } from '../../db/schema';
import { products } from '../../db/schema';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { likePattern, pageOffset } from '../../lib/pagination';
import type { AuthContext } from '../../plugins/auth';

type NamedCatalogTable = typeof categories | typeof brands;

export interface NamedCatalogConfig {
  table: NamedCatalogTable;
  productFk: typeof products.categoryId | typeof products.brandId;
  entity: string;
  label: string;
  inUseMessage: string;
  extraColumns?: Record<string, SQL | AnyPgColumn>;
}

export function createNamedCatalogService<TRow, TInput extends { name: string }>(
  db: Database,
  cfg: NamedCatalogConfig,
) {
  // Drizzle cannot infer columns through a union of tables; TRow/TInput type the public API.
  const t = cfg.table as typeof categories;
  const productCount = sql<number>`(select count(*)::int from ${products}
    where ${cfg.productFk} = ${t.id} and ${products.deletedAt} is null)`;
  const columns = { id: t.id, name: t.name, ...cfg.extraColumns, productCount };
  const byId = (companyId: number, id: number) => and(eq(t.id, id), eq(t.companyId, companyId));

  async function get(ctx: AuthContext, id: number, tx: DbOrTx = db): Promise<TRow> {
    const [row] = await tx.select(columns).from(t).where(byId(ctx.companyId, id));
    if (!row) throw AppError.notFound(cfg.label);
    return row as TRow;
  }

  return {
    get,

    async list(ctx: AuthContext, query: PaginationQuery): Promise<Paginated<TRow>> {
      const where = and(
        eq(t.companyId, ctx.companyId),
        query.q ? ilike(t.name, likePattern(query.q)) : undefined,
      );
      const { limit, offset } = pageOffset(query);
      const [items, [total]] = await Promise.all([
        db.select(columns).from(t).where(where).orderBy(asc(t.name)).limit(limit).offset(offset),
        db.select({ value: count() }).from(t).where(where),
      ]);
      return {
        items: items as TRow[],
        total: total?.value ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async create(ctx: AuthContext, input: TInput): Promise<TRow> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(t)
          .values({ ...input, companyId: ctx.companyId } as typeof t.$inferInsert)
          .returning({ id: t.id });
        await audit(tx, ctx, {
          entity: cfg.entity,
          entityId: row!.id,
          action: 'create',
          data: input,
        });
        return get(ctx, row!.id, tx);
      });
    },

    async update(ctx: AuthContext, id: number, input: TInput): Promise<TRow> {
      return db.transaction(async (tx) => {
        const updated = await tx
          .update(t)
          .set(input as Partial<typeof t.$inferInsert>)
          .where(byId(ctx.companyId, id))
          .returning({ id: t.id });
        if (updated.length === 0) throw AppError.notFound(cfg.label);
        await audit(tx, ctx, { entity: cfg.entity, entityId: id, action: 'update', data: input });
        return get(ctx, id, tx);
      });
    },

    async remove(ctx: AuthContext, id: number): Promise<void> {
      await db.transaction(async (tx) => {
        const [inUse] = await tx
          .select({ value: count() })
          .from(products)
          .where(and(eq(cfg.productFk, id), isNull(products.deletedAt)));
        if ((inUse?.value ?? 0) > 0) throw AppError.conflict(cfg.inUseMessage);
        const deleted = await tx.delete(t).where(byId(ctx.companyId, id)).returning({ id: t.id });
        if (deleted.length === 0) throw AppError.notFound(cfg.label);
        await audit(tx, ctx, { entity: cfg.entity, entityId: id, action: 'delete' });
      });
    },
  };
}

export type NamedCatalogService<TRow, TInput extends { name: string }> = ReturnType<
  typeof createNamedCatalogService<TRow, TInput>
>;
