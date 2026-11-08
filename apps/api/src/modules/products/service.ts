import { and, asc, count, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type {
  createProductSchema,
  listProductsQuerySchema,
  Paginated,
  Product,
  updateProductSchema,
} from '@stockpro/shared';
import type { Database, DbOrTx } from '../../db/client';
import { brands, categories, products } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { likePattern, pageOffset } from '../../lib/pagination';
import type { AuthContext } from '../../plugins/auth';
import { registerMovement } from '../kardex/service';
import { isLowStockSql, totalStockColumn } from './repository';
import { dates } from '@stockpro/shared';

type ListQuery = z.output<typeof listProductsQuerySchema>;
type CreateInput = z.output<typeof createProductSchema>;
type UpdateInput = z.output<typeof updateProductSchema>;

export function createProductService(db: Database) {
  const columns = {
    id: products.id,
    name: products.name,
    barcode: products.barcode,
    internalCode: products.internalCode,
    brandId: brands.id,
    brandName: brands.name,
    categoryId: categories.id,
    categoryName: categories.name,
    categoryColor: categories.color,
    salePrice: products.salePrice,
    purchasePrice: products.purchasePrice,
    minStock: products.minStock,
    stock: totalStockColumn,
    isLowStock: isLowStockSql,
    createdAt: products.createdAt,
  };

  const baseQuery = (tx: DbOrTx) =>
    tx
      .select(columns)
      .from(products)
      .leftJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(categories, eq(categories.id, products.categoryId));

  type Row = Awaited<ReturnType<ReturnType<typeof baseQuery>['execute']>>[number];
  const toDto = (r: Row): Product => ({
    id: r.id,
    name: r.name,
    barcode: r.barcode,
    internalCode: r.internalCode,
    brand: r.brandId !== null && r.brandName !== null ? { id: r.brandId, name: r.brandName } : null,
    category:
      r.categoryId !== null && r.categoryName !== null && r.categoryColor !== null
        ? { id: r.categoryId, name: r.categoryName, color: r.categoryColor }
        : null,
    salePrice: r.salePrice,
    purchasePrice: r.purchasePrice,
    minStock: r.minStock,
    stock: r.stock,
    isLowStock: r.isLowStock,
    createdAt: dates.toISO(r.createdAt),
  });

  const scope = (ctx: AuthContext, ...conds: Array<SQL | undefined>) =>
    and(eq(products.companyId, ctx.companyId), isNull(products.deletedAt), ...conds);

  async function get(ctx: AuthContext, id: number, tx: DbOrTx = db): Promise<Product> {
    const [row] = await baseQuery(tx).where(scope(ctx, eq(products.id, id)));
    if (!row) throw AppError.notFound('Producto');
    return toDto(row);
  }

  async function assertRefs(
    tx: DbOrTx,
    ctx: AuthContext,
    input: { brandId?: number | null; categoryId?: number | null },
  ) {
    if (input.brandId) {
      const [b] = await tx
        .select({ id: brands.id })
        .from(brands)
        .where(and(eq(brands.id, input.brandId), eq(brands.companyId, ctx.companyId)));
      if (!b) throw AppError.badRequest('La marca no existe');
    }
    if (input.categoryId) {
      const [c] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, input.categoryId), eq(categories.companyId, ctx.companyId)));
      if (!c) throw AppError.badRequest('La categoría no existe');
    }
  }

  return {
    get,

    async list(ctx: AuthContext, query: ListQuery): Promise<Paginated<Product>> {
      const where = scope(
        ctx,
        query.q
          ? or(
              ilike(products.name, likePattern(query.q)),
              ilike(products.barcode, likePattern(query.q)),
              ilike(products.internalCode, likePattern(query.q)),
            )
          : undefined,
        query.categoryId ? eq(products.categoryId, query.categoryId) : undefined,
        query.brandId ? eq(products.brandId, query.brandId) : undefined,
        query.lowStock === true ? isLowStockSql : undefined,
      );
      const { limit, offset } = pageOffset(query);
      const [rows, [total]] = await Promise.all([
        baseQuery(db)
          .where(where)
          .orderBy(asc(products.name), asc(products.id))
          .limit(limit)
          .offset(offset),
        db.select({ value: count() }).from(products).where(where),
      ]);
      return {
        items: rows.map(toDto),
        total: total?.value ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async create(ctx: AuthContext, input: CreateInput): Promise<Product> {
      return db.transaction(async (tx) => {
        await assertRefs(tx, ctx, input);
        const { initialStock, warehouseId, ...data } = input;
        const [created] = await tx
          .insert(products)
          .values({ ...data, companyId: ctx.companyId })
          .returning({ id: products.id });
        if (!created) throw new Error('product insert failed');
        await audit(tx, ctx, { entity: 'product', entityId: created.id, action: 'create', data });
        if (initialStock && Number(initialStock) > 0) {
          await registerMovement(tx, ctx, {
            type: 'in',
            productId: created.id,
            warehouseId,
            quantity: initialStock,
            unitCost: data.purchasePrice,
            note: 'Stock inicial',
          });
        }
        return get(ctx, created.id, tx);
      });
    },

    async update(ctx: AuthContext, id: number, input: UpdateInput): Promise<Product> {
      return db.transaction(async (tx) => {
        await assertRefs(tx, ctx, input);
        const updated = await tx
          .update(products)
          .set(input)
          .where(scope(ctx, eq(products.id, id)))
          .returning({ id: products.id });
        if (updated.length === 0) throw AppError.notFound('Producto');
        await audit(tx, ctx, { entity: 'product', entityId: id, action: 'update', data: input });
        return get(ctx, id, tx);
      });
    },

    async remove(ctx: AuthContext, id: number) {
      await db.transaction(async (tx) => {
        const deleted = await tx
          .update(products)
          .set({ deletedAt: dates.now() })
          .where(scope(ctx, eq(products.id, id)))
          .returning({ id: products.id });
        if (deleted.length === 0) throw AppError.notFound('Producto');
        await audit(tx, ctx, { entity: 'product', entityId: id, action: 'delete' });
      });
    },
  };
}
