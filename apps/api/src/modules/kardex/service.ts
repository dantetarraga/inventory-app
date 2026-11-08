import { and, count, desc, eq, gte, ilike, isNull, lt, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type {
  createMovementSchema,
  listMovementsQuerySchema,
  Movement,
  Paginated,
} from '@stockpro/shared';
import type { Database, DbOrTx, Tx } from '../../db/client';
import { kardexMovements, products, stock, users, warehouses } from '../../db/schema';
import { AppError, PG, pgErrorCode } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { likePattern, pageOffset } from '../../lib/pagination';
import type { AuthContext } from '../../plugins/auth';

export type CreateMovement = z.output<typeof createMovementSchema>;
type ListMovementsQuery = z.output<typeof listMovementsQuerySchema>;

export async function resolveWarehouseId(db: DbOrTx, companyId: number, warehouseId?: number) {
  const [wh] = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(
      and(
        eq(warehouses.companyId, companyId),
        warehouseId ? eq(warehouses.id, warehouseId) : eq(warehouses.isDefault, true),
      ),
    );
  if (!wh)
    throw warehouseId
      ? AppError.notFound('Almacén')
      : AppError.conflict('No hay almacén predeterminado');
  return wh.id;
}

/**
 * Registers a stock movement. MUST run inside a transaction: the stock row is locked
 * (`SELECT … FOR UPDATE`) so concurrent movements on the same product/warehouse are serialized
 * and the `stock >= 0` check constraint guarantees we never go negative.
 */
export async function registerMovement(tx: Tx, ctx: AuthContext, input: CreateMovement) {
  const [product] = await tx
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(
      and(
        eq(products.id, input.productId),
        eq(products.companyId, ctx.companyId),
        isNull(products.deletedAt),
      ),
    );
  if (!product) throw AppError.notFound('Producto');

  const warehouseId = await resolveWarehouseId(tx, ctx.companyId, input.warehouseId);

  await tx.insert(stock).values({ productId: product.id, warehouseId }).onConflictDoNothing();
  const [locked] = await tx
    .select({ quantity: stock.quantity })
    .from(stock)
    .where(and(eq(stock.productId, product.id), eq(stock.warehouseId, warehouseId)))
    .for('update');
  if (!locked) throw new Error('stock row missing after upsert');

  // All arithmetic happens in Postgres numeric — no floating point in JS.
  const newQuantity =
    input.type === 'in'
      ? sql`${stock.quantity} + ${input.quantity}::numeric`
      : input.type === 'out'
        ? sql`${stock.quantity} - ${input.quantity}::numeric`
        : sql`${input.quantity}::numeric`;

  let balance: { balanceAfter: string; delta: string } | undefined;
  try {
    [balance] = await tx
      .update(stock)
      .set({ quantity: newQuantity })
      .where(and(eq(stock.productId, product.id), eq(stock.warehouseId, warehouseId)))
      .returning({
        balanceAfter: stock.quantity,
        delta: sql<string>`${stock.quantity} - ${locked.quantity}::numeric`,
      });
  } catch (err) {
    if (pgErrorCode(err) === PG.CHECK_VIOLATION) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        `Stock insuficiente de "${product.name}": disponible ${Number(locked.quantity)}`,
      );
    }
    throw err;
  }
  if (!balance) throw new Error('stock update returned no row');
  if (Number(balance.delta) === 0) {
    throw AppError.badRequest('El ajuste no cambia el stock actual');
  }

  const [movement] = await tx
    .insert(kardexMovements)
    .values({
      companyId: ctx.companyId,
      productId: product.id,
      warehouseId,
      userId: ctx.userId,
      type: input.type,
      delta: balance.delta,
      balanceAfter: balance.balanceAfter,
      unitCost: input.unitCost ?? null,
      note: input.note ?? null,
    })
    .returning({ id: kardexMovements.id });
  if (!movement) throw new Error('movement insert failed');

  await audit(tx, ctx, {
    entity: 'kardex',
    entityId: movement.id,
    action: input.type,
    data: { productId: product.id, warehouseId, delta: balance.delta },
  });
  return movement.id;
}

export function createKardexService(db: Database) {
  const columns = {
    id: kardexMovements.id,
    type: kardexMovements.type,
    delta: kardexMovements.delta,
    balanceAfter: kardexMovements.balanceAfter,
    unitCost: kardexMovements.unitCost,
    note: kardexMovements.note,
    occurredAt: kardexMovements.occurredAt,
    product: { id: products.id, name: products.name },
    warehouse: { id: warehouses.id, name: warehouses.name },
    user: { id: users.id, fullName: users.fullName },
  };

  const baseQuery = (tx: DbOrTx) =>
    tx
      .select(columns)
      .from(kardexMovements)
      .innerJoin(products, eq(products.id, kardexMovements.productId))
      .innerJoin(warehouses, eq(warehouses.id, kardexMovements.warehouseId))
      .innerJoin(users, eq(users.id, kardexMovements.userId));

  const toDto = (
    r: Awaited<ReturnType<ReturnType<typeof baseQuery>['execute']>>[number],
  ): Movement => ({
    ...r,
    occurredAt: r.occurredAt.toISOString(),
  });

  return {
    async create(ctx: AuthContext, input: CreateMovement): Promise<Movement> {
      return db.transaction(async (tx) => {
        const id = await registerMovement(tx, ctx, input);
        const [row] = await baseQuery(tx).where(eq(kardexMovements.id, id));
        return toDto(row!);
      });
    },

    async list(ctx: AuthContext, query: ListMovementsQuery): Promise<Paginated<Movement>> {
      const where = and(
        eq(kardexMovements.companyId, ctx.companyId),
        query.productId ? eq(kardexMovements.productId, query.productId) : undefined,
        query.warehouseId ? eq(kardexMovements.warehouseId, query.warehouseId) : undefined,
        query.type ? eq(kardexMovements.type, query.type) : undefined,
        query.from ? gte(kardexMovements.occurredAt, sql`${query.from}::date`) : undefined,
        query.to ? lt(kardexMovements.occurredAt, sql`${query.to}::date + 1`) : undefined,
        query.q
          ? or(
              ilike(products.name, likePattern(query.q)),
              ilike(kardexMovements.note, likePattern(query.q)),
            )
          : undefined,
      );
      const { limit, offset } = pageOffset(query);
      const [rows, [total]] = await Promise.all([
        baseQuery(db)
          .where(where)
          .orderBy(desc(kardexMovements.occurredAt), desc(kardexMovements.id))
          .limit(limit)
          .offset(offset),
        db
          .select({ value: count() })
          .from(kardexMovements)
          .innerJoin(products, eq(products.id, kardexMovements.productId))
          .where(where),
      ]);
      return {
        items: rows.map(toDto),
        total: total?.value ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    },
  };
}
