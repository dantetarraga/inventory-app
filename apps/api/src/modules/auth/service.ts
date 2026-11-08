import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { loginSchema, Me, registerSchema, Theme } from '@stockpro/shared';
import type { z } from 'zod';
import type { DbOrTx } from '../../db/client';
import { companies, refreshTokens, userPermissions, users, warehouses } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { effectivePermissions } from '../../plugins/auth';

const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = await hash('dummy-password-for-timing', ARGON2_OPTIONS);

export const hashPassword = (password: string) => hash(password, ARGON2_OPTIONS);

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export function createAuthService(app: FastifyInstance) {
  const { db, env } = app;

  async function issueTokens(
    tx: DbOrTx,
    user: { id: number; companyId: number },
    familyId: string = randomUUID(),
  ): Promise<IssuedTokens> {
    const accessToken = app.jwt.sign({ sub: String(user.id), cid: user.companyId });
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    await tx.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      familyId,
      expiresAt: refreshExpiresAt,
    });
    return { accessToken, refreshToken, refreshExpiresAt };
  }

  async function getMe(userId: number, tx: DbOrTx = db): Promise<Me> {
    const [row] = await tx
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        theme: users.theme,
        company: {
          id: companies.id,
          name: companies.name,
          currency: companies.currency,
          country: companies.country,
        },
      })
      .from(users)
      .innerJoin(companies, eq(companies.id, users.companyId))
      .where(eq(users.id, userId));
    if (!row) throw AppError.unauthorized();
    const granted = await tx
      .select({ module: userPermissions.module })
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));
    const { company, ...user } = row;
    return {
      user: {
        ...user,
        permissions: effectivePermissions(
          user.role,
          granted.map((g) => g.module),
        ),
      },
      company,
    };
  }

  return {
    getMe,

    /** Creates a company with its first admin user and default warehouse. */
    async register(input: z.output<typeof registerSchema>) {
      const passwordHash = await hashPassword(input.password);
      return db.transaction(async (tx) => {
        const [company] = await tx
          .insert(companies)
          .values({ name: input.companyName, currency: input.currency, country: input.country })
          .returning({ id: companies.id });
        if (!company) throw new Error('company insert failed');
        await tx
          .insert(warehouses)
          .values({ companyId: company.id, name: 'Almacén principal', isDefault: true });
        const [user] = await tx
          .insert(users)
          .values({
            companyId: company.id,
            email: input.email,
            passwordHash,
            fullName: input.fullName,
            role: 'admin',
          })
          .returning({ id: users.id, companyId: users.companyId });
        if (!user) throw new Error('user insert failed');
        const tokens = await issueTokens(tx, user);
        return { tokens, me: await getMe(user.id, tx) };
      });
    },

    async login(input: z.output<typeof loginSchema>) {
      const [user] = await db
        .select({
          id: users.id,
          companyId: users.companyId,
          passwordHash: users.passwordHash,
          status: users.status,
        })
        .from(users)
        .where(eq(sql`lower(${users.email})`, input.email.toLowerCase()));

      const valid = await verify(user?.passwordHash ?? DUMMY_HASH, input.password);
      if (!user || !valid) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
      }
      if (user.status !== 'active') {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Tu cuenta está desactivada');
      }
      const tokens = await issueTokens(db, user);
      return { tokens, me: await getMe(user.id) };
    },

    /** Rotates a refresh token. Reusing an already-rotated token revokes the whole family. */
    async refresh(refreshToken: string) {
      const result = await db.transaction(async (tx) => {
        const [stored] = await tx
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, sha256(refreshToken)))
          .for('update');
        if (!stored) throw AppError.unauthorized('Sesión inválida');

        if (stored.revokedAt) {
          // Return (not throw) so the family revocation is committed.
          await tx
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(
              and(eq(refreshTokens.familyId, stored.familyId), isNull(refreshTokens.revokedAt)),
            );
          app.log.warn({ userId: stored.userId }, 'refresh token reuse detected; family revoked');
          return { reused: true as const };
        }
        if (stored.expiresAt < new Date()) throw AppError.unauthorized('Sesión expirada');

        const [user] = await tx
          .select({ id: users.id, companyId: users.companyId, status: users.status })
          .from(users)
          .where(eq(users.id, stored.userId));
        if (!user || user.status !== 'active') throw AppError.unauthorized('Sesión inválida');

        await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(refreshTokens.id, stored.id));
        const tokens = await issueTokens(tx, user, stored.familyId);
        return { reused: false as const, tokens, me: await getMe(user.id, tx) };
      });
      if (result.reused) throw AppError.unauthorized('Sesión inválida');
      return result;
    },

    async logout(refreshToken: string | undefined) {
      if (!refreshToken) return;
      const [stored] = await db
        .select({ familyId: refreshTokens.familyId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, sha256(refreshToken)));
      if (!stored) return;
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, stored.familyId), isNull(refreshTokens.revokedAt)));
    },

    async updatePreferences(userId: number, prefs: { theme: Theme }) {
      await db.update(users).set({ theme: prefs.theme }).where(eq(users.id, userId));
      return getMe(userId);
    },
  };
}
