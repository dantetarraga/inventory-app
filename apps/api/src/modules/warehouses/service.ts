import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import type { z } from 'zod';
import type {
  PaginationQuery,
  Paginated,
  upsertWarehouseSchema,
  Warehouse,
} from '@stockpro/shared';
import type { Database, DbOrTx } from '../../db/client';
import { kardexMovements, stock, warehouses } from '../../db/schema';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { likePattern, pageOffset } from '../../lib/pagination';
import type { AuthContext } from '../../plugins/auth';

type UpsertWarehouse = z.output<typeof upsertWarehouseSchema>;

const columns = {
  id: warehouses.id,
  name: warehouses.name,
  address: warehouses.address,
  isDefault: warehouses.isDefault,
};

const byId = (companyId: number, id: number) =>
  and(eq(warehouses.id, id), eq(warehouses.companyId, companyId));

export function createWarehouseService(db: Database) {
  async function get(ctx: AuthContext, id: number, tx: DbOrTx = db): Promise<Warehouse> {
    const [row] = await tx.select(columns).from(warehouses).where(byId(ctx.companyId, id));
    if (!row) throw AppError.notFound('Almacén');
    return row;
  }

  return {
    get,

    async list(ctx: AuthContext, query: PaginationQuery): Promise<Paginated<Warehouse>> {
      const where = and(
        eq(warehouses.companyId, ctx.companyId),
        query.q ? ilike(warehouses.name, likePattern(query.q)) : undefined,
      );
      const { limit, offset } = pageOffset(query);
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
      return { items, total: total?.value ?? 0, page: query.page, pageSize: query.pageSize };
    },

    async create(ctx: AuthContext, input: UpsertWarehouse): Promise<Warehouse> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(warehouses)
          .values({ ...input, companyId: ctx.companyId })
          .returning({ id: warehouses.id });
        await audit(tx, ctx, {
          entity: 'warehouse',
          entityId: row!.id,
          action: 'create',
          data: input,
        });
        return get(ctx, row!.id, tx);
      });
    },

    async update(ctx: AuthContext, id: number, input: UpsertWarehouse): Promise<Warehouse> {
      return db.transaction(async (tx) => {
        const updated = await tx
          .update(warehouses)
          .set(input)
          .where(byId(ctx.companyId, id))
          .returning({ id: warehouses.id });
        if (updated.length === 0) throw AppError.notFound('Almacén');
        await audit(tx, ctx, { entity: 'warehouse', entityId: id, action: 'update', data: input });
        return get(ctx, id, tx);
      });
    },

    async setDefault(ctx: AuthContext, id: number): Promise<Warehouse> {
      return db.transaction(async (tx) => {
        await get(ctx, id, tx);
        await tx
          .update(warehouses)
          .set({ isDefault: false })
          .where(and(eq(warehouses.companyId, ctx.companyId), eq(warehouses.isDefault, true)));
        await tx.update(warehouses).set({ isDefault: true }).where(byId(ctx.companyId, id));
        await audit(tx, ctx, { entity: 'warehouse', entityId: id, action: 'set_default' });
        return get(ctx, id, tx);
      });
    },

    async remove(ctx: AuthContext, id: number): Promise<void> {
      await db.transaction(async (tx) => {
        const wh = await get(ctx, id, tx);
        if (wh.isDefault) throw AppError.conflict('No se puede eliminar el almacén predeterminado');
        const [used] = await tx
          .select({ value: count() })
          .from(kardexMovements)
          .where(eq(kardexMovements.warehouseId, wh.id));
        if ((used?.value ?? 0) > 0) {
          throw AppError.conflict('No se puede eliminar: el almacén tiene movimientos registrados');
        }
        await tx.delete(stock).where(eq(stock.warehouseId, wh.id));
        await tx.delete(warehouses).where(byId(ctx.companyId, wh.id));
        await audit(tx, ctx, { entity: 'warehouse', entityId: wh.id, action: 'delete' });
      });
    },
  };
}
