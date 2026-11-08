import fp from 'fastify-plugin';
import type { FastifyError } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import type { Problem } from '@stockpro/shared';
import { AppError, PG, pgConstraint, pgErrorCode } from '../lib/errors';

const PROBLEM_TYPE = 'about:blank';

/** Maps known unique constraints to friendly messages. */
const UNIQUE_MESSAGES: Record<string, string> = {
  users_email_unique: 'Ya existe un usuario con ese email',
  categories_company_name_unique: 'Ya existe una categoría con ese nombre',
  brands_company_name_unique: 'Ya existe una marca con ese nombre',
  warehouses_company_name_unique: 'Ya existe un almacén con ese nombre',
  products_company_barcode_unique: 'Ya existe un producto con ese código de barras',
};

export default fp(
  async (app) => {
    app.setNotFoundHandler((req, reply) => {
      const body: Problem = {
        type: PROBLEM_TYPE,
        title: 'Ruta no encontrada',
        status: 404,
        code: 'NOT_FOUND',
        detail: `${req.method} ${req.url}`,
      };
      return reply.status(404).type('application/problem+json').send(body);
    });

    app.setErrorHandler((err: FastifyError, req, reply) => {
      const send = (problem: Problem) =>
        reply.status(problem.status).type('application/problem+json').send(problem);

      if (err instanceof AppError) {
        return send({ type: PROBLEM_TYPE, title: err.message, status: err.status, code: err.code });
      }

      if (hasZodFastifySchemaValidationErrors(err)) {
        return send({
          type: PROBLEM_TYPE,
          title: 'Datos inválidos',
          status: 400,
          code: 'VALIDATION_ERROR',
          errors: err.validation.map((v) => ({
            path: (v.instancePath || '').replace(/^\//, '').replace(/\//g, '.'),
            message: v.message ?? 'Inválido',
          })),
        });
      }

      if (isResponseSerializationError(err)) {
        req.log.error({ err, issues: err.cause.issues }, 'response serialization failed');
        return send({ type: PROBLEM_TYPE, title: 'Error interno', status: 500, code: 'INTERNAL' });
      }

      const pgCode = pgErrorCode(err);
      if (pgCode === PG.UNIQUE_VIOLATION) {
        const constraint = pgConstraint(err) ?? '';
        return send({
          type: PROBLEM_TYPE,
          title: UNIQUE_MESSAGES[constraint] ?? 'El registro ya existe',
          status: 409,
          code: 'CONFLICT',
        });
      }
      if (pgCode === PG.FOREIGN_KEY_VIOLATION) {
        return send({
          type: PROBLEM_TYPE,
          title: 'El registro está en uso o referencia datos inexistentes',
          status: 409,
          code: 'CONFLICT',
        });
      }

      if (err.statusCode === 429) {
        return send({
          type: PROBLEM_TYPE,
          title: 'Demasiados intentos, espera un momento',
          status: 429,
          code: 'RATE_LIMITED',
        });
      }

      if (err.statusCode && err.statusCode < 500) {
        return send({
          type: PROBLEM_TYPE,
          title: err.message,
          status: err.statusCode,
          code: 'BAD_REQUEST',
        });
      }

      req.log.error({ err }, 'unhandled error');
      return send({ type: PROBLEM_TYPE, title: 'Error interno', status: 500, code: 'INTERNAL' });
    });
  },
  { name: 'errors' },
);
