import type { AuthResponse, Problem } from '@stockpro/shared';
import { useSession } from '@/stores/session';

const BASE = import.meta.env.VITE_API_URL ?? '/api';
const CSRF_HEADER = { 'x-requested-with': 'stockpro' };

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors: Problem['errors'];

  constructor(problem: Problem) {
    super(problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.code = problem.code;
    this.fieldErrors = problem.errors;
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

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<Problem>;
    return new ApiError({
      type: body.type ?? 'about:blank',
      title: body.title ?? res.statusText,
      status: res.status,
      code: body.code,
      errors: body.errors,
    });
  } catch {
    return new ApiError({
      type: 'about:blank',
      title: res.statusText || 'Error de red',
      status: res.status,
    });
  }
}

let refreshing: Promise<AuthResponse | null> | null = null;

/**
 * Exchanges the httpOnly refresh cookie for a new access token.
 * Single-flight: concurrent callers share one request so the rotated token isn't reused.
 */
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

  const res = await fetch(buildUrl(path, opts.query), {
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

/** Downloads a binary response (e.g. an xlsx report) and triggers a browser save. */
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
