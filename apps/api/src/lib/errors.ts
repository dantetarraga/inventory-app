import type { ErrorCode } from '@stockpro/shared';

export type { ErrorCode };

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string) {
    return new AppError(400, 'BAD_REQUEST', message);
  }
  static unauthorized(message = 'No autenticado') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'No tienes permiso para esta acción') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(entity = 'Recurso') {
    return new AppError(404, 'NOT_FOUND', `${entity} no encontrado`);
  }
  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }
}

export const PG = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
} as const;

export function pgErrorCode(err: unknown): string | undefined {
  for (let e: unknown = err, i = 0; e && i < 3; e = (e as { cause?: unknown }).cause, i++) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

export function pgConstraint(err: unknown): string | undefined {
  for (let e: unknown = err, i = 0; e && i < 3; e = (e as { cause?: unknown }).cause, i++) {
    const c = (e as { constraint?: unknown }).constraint;
    if (typeof c === 'string') return c;
  }
  return undefined;
}
