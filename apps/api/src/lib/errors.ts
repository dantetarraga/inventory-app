export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_STOCK'
  | 'RATE_LIMITED'
  | 'INTERNAL';

/** Expected, user-facing error. Rendered as RFC 7807 problem+json by the error handler. */
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

/** Postgres error codes we translate into friendly API errors. */
export const PG = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
} as const;

export function pgErrorCode(err: unknown): string | undefined {
  // drizzle wraps driver errors in `cause`
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
