import { and, asc, count, eq, ilike, inArray, or } from 'drizzle-orm';
import type { z } from 'zod';
import type {
  createUserSchema,
  ModuleCode,
  PaginationQuery,
  updateUserSchema,
  User,
} from '@stockpro/shared';
import type { Database, DbOrTx } from '../../db/client';
import { userPermissions, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { likePattern, pageOffset } from '../../lib/pagination';
import type { AuthContext } from '../../plugins/auth';
import { effectivePermissions } from '../../plugins/auth';
import { hashPassword } from '../auth/service';

const userColumns = {
  id: users.id,
  email: users.email,
  fullName: users.fullName,
  docType: users.docType,
  docNumber: users.docNumber,
  phone: users.phone,
  address: users.address,
  role: users.role,
  status: users.status,
  createdAt: users.createdAt,
};

async function withPermissions(
  db: DbOrTx,
  rows: Array<Omit<User, 'permissions' | 'createdAt'> & { createdAt: Date }>,
): Promise<User[]> {
  if (rows.length === 0) return [];
  const perms = await db
    .select()
    .from(userPermissions)
    .where(
      inArray(
        userPermissions.userId,
        rows.map((r) => r.id),
      ),
    );
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    permissions: effectivePermissions(
      r.role,
      perms.filter((p) => p.userId === r.id).map((p) => p.module),
    ),
  }));
}

async function replacePermissions(db: DbOrTx, userId: number, modules: ModuleCode[]) {
  await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
  if (modules.length > 0) {
    await db
      .insert(userPermissions)
      .values([...new Set(modules)].map((module) => ({ userId, module })));
  }
}

export function createUserService(db: Database) {
  async function get(ctx: AuthContext, id: number, tx: DbOrTx = db): Promise<User> {
    const rows = await tx
      .select(userColumns)
      .from(users)
      .where(and(eq(users.id, id), eq(users.companyId, ctx.companyId)));
    const [user] = await withPermissions(tx, rows);
    if (!user) throw AppError.notFound('Usuario');
    return user;
  }

  return {
    get,

    async list(ctx: AuthContext, query: PaginationQuery) {
      const where = and(
        eq(users.companyId, ctx.companyId),
        query.q
          ? or(
              ilike(users.fullName, likePattern(query.q)),
              ilike(users.email, likePattern(query.q)),
            )
          : undefined,
      );
      const [rows, [total]] = await Promise.all([
        db
          .select(userColumns)
          .from(users)
          .where(where)
          .orderBy(asc(users.fullName))
          .limit(pageOffset(query).limit)
          .offset(pageOffset(query).offset),
        db.select({ value: count() }).from(users).where(where),
      ]);
      return {
        items: await withPermissions(db, rows),
        total: total?.value ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async create(ctx: AuthContext, input: z.output<typeof createUserSchema>) {
      assertCanManage(ctx, input.role);
      const passwordHash = await hashPassword(input.password);
      return db.transaction(async (tx) => {
        const { permissions, password: _password, ...data } = input;
        const [created] = await tx
          .insert(users)
          .values({ ...data, companyId: ctx.companyId, passwordHash })
          .returning({ id: users.id });
        if (!created) throw new Error('user insert failed');
        if (input.role === 'employee') await replacePermissions(tx, created.id, permissions);
        await audit(tx, ctx, {
          entity: 'user',
          entityId: created.id,
          action: 'create',
          data: { email: input.email, role: input.role, permissions },
        });
        return get(ctx, created.id, tx);
      });
    },

    async update(ctx: AuthContext, id: number, input: z.output<typeof updateUserSchema>) {
      const passwordHash = input.password ? await hashPassword(input.password) : undefined;
      return db.transaction(async (tx) => {
        const current = await get(ctx, id, tx);
        assertCanManage(ctx, current.role, input.role);
        if (id === ctx.userId && (input.role !== 'admin' || input.status !== 'active')) {
          throw AppError.badRequest('No puedes quitarte el rol de administrador ni desactivarte');
        }
        if (current.role === 'admin' && (input.role !== 'admin' || input.status !== 'active')) {
          await ensureAnotherActiveAdmin(tx, ctx.companyId, id);
        }
        const { permissions, password: _password, ...data } = input;
        await tx
          .update(users)
          .set({ ...data, ...(passwordHash ? { passwordHash } : {}) })
          .where(and(eq(users.id, id), eq(users.companyId, ctx.companyId)));
        await replacePermissions(tx, id, input.role === 'employee' ? permissions : []);
        await audit(tx, ctx, {
          entity: 'user',
          entityId: id,
          action: 'update',
          data: {
            role: input.role,
            status: input.status,
            permissions,
            passwordChanged: !!passwordHash,
          },
        });
        return get(ctx, id, tx);
      });
    },

    async remove(ctx: AuthContext, id: number) {
      if (id === ctx.userId) throw AppError.badRequest('No puedes eliminar tu propio usuario');
      await db.transaction(async (tx) => {
        const current = await get(ctx, id, tx);
        assertCanManage(ctx, current.role);
        if (current.role === 'admin') await ensureAnotherActiveAdmin(tx, ctx.companyId, id);
        // Users with kardex history cannot be deleted (FK restrict) → the error handler returns 409.
        await tx.delete(users).where(and(eq(users.id, id), eq(users.companyId, ctx.companyId)));
        await audit(tx, ctx, {
          entity: 'user',
          entityId: id,
          action: 'delete',
          data: { email: current.email },
        });
      });
    },
  };
}

/** Only admins may create, modify or delete admin accounts (prevents privilege escalation). */
function assertCanManage(ctx: AuthContext, ...roles: Array<'admin' | 'employee'>) {
  if (ctx.role !== 'admin' && roles.includes('admin')) {
    throw AppError.forbidden('Solo un administrador puede gestionar administradores');
  }
}

async function ensureAnotherActiveAdmin(db: DbOrTx, companyId: number, excludingId: number) {
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.companyId, companyId), eq(users.role, 'admin'), eq(users.status, 'active')),
    );
  if (!admins.some((a) => a.id !== excludingId)) {
    throw AppError.badRequest('La empresa debe tener al menos un administrador activo');
  }
}
