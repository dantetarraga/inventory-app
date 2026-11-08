import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import type { ModuleCode, Role } from '@stockpro/shared';
import { MODULE_CODES } from '@stockpro/shared';
import { userPermissions, users } from '../db/schema';
import { AppError } from '../lib/errors';

export interface AuthContext {
  userId: number;
  companyId: number;
  role: Role;
  permissions: ReadonlySet<ModuleCode>;
}

export interface AccessTokenPayload {
  sub: string;
  cid: number;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

type Hook = (req: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
  interface FastifyInstance {
    authenticate: Hook;
    requirePermission: (module: ModuleCode) => Hook;
    requireAdmin: Hook;
  }
}

export function effectivePermissions(role: Role, granted: ModuleCode[]): ModuleCode[] {
  return role === 'admin' ? [...MODULE_CODES] : MODULE_CODES.filter((m) => granted.includes(m));
}

export default fp(
  async (app) => {
    await app.register(jwt, {
      secret: app.env.JWT_SECRET,
      sign: { expiresIn: app.env.ACCESS_TOKEN_TTL, algorithm: 'HS256' },
      verify: { algorithms: ['HS256'] },
    });

    app.decorateRequest('auth', null as unknown as AuthContext);

    app.decorate('authenticate', async (req: FastifyRequest) => {
      let payload: AccessTokenPayload;
      try {
        payload = await req.jwtVerify<AccessTokenPayload>();
      } catch {
        throw AppError.unauthorized('Sesión inválida o expirada');
      }
      const userId = Number(payload.sub);
      // Loaded on every request so deactivation and permission changes apply immediately.
      const [user] = await app.db
        .select({
          id: users.id,
          companyId: users.companyId,
          role: users.role,
          status: users.status,
        })
        .from(users)
        .where(eq(users.id, userId));
      if (!user || user.status !== 'active' || user.companyId !== payload.cid) {
        throw AppError.unauthorized('Sesión inválida o expirada');
      }
      const granted = await app.db
        .select({ module: userPermissions.module })
        .from(userPermissions)
        .where(eq(userPermissions.userId, userId));
      req.auth = {
        userId: user.id,
        companyId: user.companyId,
        role: user.role,
        permissions: new Set(
          effectivePermissions(
            user.role,
            granted.map((g) => g.module),
          ),
        ),
      };
    });

    app.decorate('requirePermission', (module: ModuleCode) => async (req: FastifyRequest) => {
      if (!req.auth.permissions.has(module)) throw AppError.forbidden();
    });

    app.decorate('requireAdmin', async (req: FastifyRequest) => {
      if (req.auth.role !== 'admin') throw AppError.forbidden();
    });
  },
  { name: 'auth', dependencies: ['env', 'db'] },
);
