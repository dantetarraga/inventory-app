import type { AuthResponse, ErrorCode, Problem } from '@stockpro/shared';
import { useSession } from '@/stores/session';

const BASE = import.meta.env.VITE_API_URL ?? '/api';
const CSRF_HEADER = { 'x-requested-with': 'stockpro' };

export type ClientErrorCode = ErrorCode | 'NETWORK' | 'UNAVAILABLE';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;
  readonly fieldErrors: Problem['errors'];

  constructor(init: {
    title: string;
    status: number;
    code: ClientErrorCode;
    errors?: Problem['errors'];
  }) {
    super(init.title);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.errors;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query) {
  const url = `${BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export const FRIENDLY_MESSAGES = {
  offline: 'No hay conexión con StockPRO. Revisa tu internet e inténtalo de nuevo.',
  unavailable: 'StockPRO no está disponible en este momento. Inténtalo de nuevo en unos minutos.',
  server: 'No pudimos completar la acción por un problema en el servidor. Inténtalo de nuevo.',
  unexpected: 'No pudimos completar la acción. Inténtalo de nuevo.',
} as const;

function friendlyFallback(status: number) {
  if (status === 0) return FRIENDLY_MESSAGES.offline;
  if (status === 502 || status === 503 || status === 504) return FRIENDLY_MESSAGES.unavailable;
  if (status >= 500) return FRIENDLY_MESSAGES.server;
  return FRIENDLY_MESSAGES.unexpected;
}

async function toError(res: Response): Promise<ApiError> {
  const isProblem = (res.headers.get('content-type') ?? '').includes('json');
  const body = isProblem ? ((await res.json().catch(() => ({}))) as Partial<Problem>) : {};
  // A 5xx without problem+json means the API did not answer (proxy or gateway), not an API error.
  const apiAnswered = isProblem && typeof body.title === 'string';
  const status = res.status;
  const title =
    apiAnswered && status < 500
      ? body.title!
      : !apiAnswered && status >= 500
        ? FRIENDLY_MESSAGES.unavailable
        : friendlyFallback(status);
  return new ApiError({
    title,
    status,
    code: apiAnswered && body.code ? body.code : status >= 500 ? 'UNAVAILABLE' : 'BAD_REQUEST',
    errors: body.errors,
  });
}

async function safeFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError({
      title: FRIENDLY_MESSAGES.offline,
      status: 0,
      code: 'NETWORK',
    });
  }
}

let refreshing: Promise<AuthResponse | null> | null = null;

// Single-flight: concurrent 401s share one refresh so a rotated token is never reused.
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: CSRF_HEADER,
      });
      if (!res.ok) {
        useSession.getState().clear();
        return null;
      }
      const auth = (await res.json()) as AuthResponse;
      useSession.getState().setSession(auth);
      return auth;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function send(path: string, opts: RequestOptions, retried = false): Promise<Response> {
  const token = useSession.getState().accessToken;
  const headers: Record<string, string> = { ...CSRF_HEADER };
  if (token) headers.authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';

  const res = await safeFetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
    signal: opts.signal,
  });

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) return send(path, opts, true);
  }
  if (!res.ok) throw await toError(res);
  return res;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function download(path: string, query: Query, fallbackName: string) {
  const res = await send(path, { query });
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
