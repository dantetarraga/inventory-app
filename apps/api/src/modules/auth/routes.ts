import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  authResponseSchema,
  loginSchema,
  meSchema,
  registerSchema,
  updatePreferencesSchema,
} from '@stockpro/shared';
import { AppError } from '../../lib/errors';
import { createAuthService, type IssuedTokens } from './service';

export const REFRESH_COOKIE = 'stockpro_rt';
const COOKIE_PATH = '/api/auth';

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = createAuthService(app);
  const secure = app.env.NODE_ENV === 'production';
  const authRateLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

  const setRefreshCookie = (reply: FastifyReply, tokens: IssuedTokens) =>
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: COOKIE_PATH,
      expires: tokens.refreshExpiresAt,
    });

  // Browsers cannot send a custom header cross-site without a CORS preflight, so this blocks CSRF.
  const requireCsrfHeader = async (req: FastifyRequest) => {
    if (req.headers['x-requested-with'] !== 'stockpro')
      throw AppError.forbidden('Falta cabecera CSRF');
  };

  app.post(
    '/register',
    {
      config: authRateLimit,
      schema: { tags: ['auth'], body: registerSchema, response: { 201: authResponseSchema } },
    },
    async (req, reply) => {
      const { tokens, me } = await service.register(req.body);
      setRefreshCookie(reply, tokens);
      return reply.status(201).send({ accessToken: tokens.accessToken, me });
    },
  );

  app.post(
    '/login',
    {
      config: authRateLimit,
      schema: { tags: ['auth'], body: loginSchema, response: { 200: authResponseSchema } },
    },
    async (req, reply) => {
      const { tokens, me } = await service.login(req.body);
      setRefreshCookie(reply, tokens);
      return { accessToken: tokens.accessToken, me };
    },
  );

  app.post(
    '/refresh',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      onRequest: requireCsrfHeader,
      schema: { tags: ['auth'], response: { 200: authResponseSchema } },
    },
    async (req, reply) => {
      const token = req.cookies[REFRESH_COOKIE];
      if (!token) throw AppError.unauthorized('Sin sesión');
      try {
        const { tokens, me } = await service.refresh(token);
        setRefreshCookie(reply, tokens);
        return { accessToken: tokens.accessToken, me };
      } catch (err) {
        reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
        throw err;
      }
    },
  );

  app.post(
    '/logout',
    { onRequest: requireCsrfHeader, schema: { tags: ['auth'], response: { 204: z.null() } } },
    async (req, reply) => {
      await service.logout(req.cookies[REFRESH_COOKIE]);
      reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
      return reply.status(204).send(null);
    },
  );

  app.get(
    '/me',
    { onRequest: app.authenticate, schema: { tags: ['auth'], response: { 200: meSchema } } },
    async (req) => service.getMe(req.auth.userId),
  );

  app.patch(
    '/me/preferences',
    {
      onRequest: app.authenticate,
      schema: { tags: ['auth'], body: updatePreferencesSchema, response: { 200: meSchema } },
    },
    async (req) => service.updatePreferences(req.auth.userId, req.body),
  );
};
