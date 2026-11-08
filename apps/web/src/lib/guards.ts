import { redirect } from '@tanstack/react-router';
import type { ModuleCode } from '@stockpro/shared';
import { refreshSession } from './http';
import { hasPermission, useSession } from '@/stores/session';

/** Ensures there is a session, restoring it from the refresh cookie if needed. */
export async function ensureSession(redirectTo: string) {
  if (useSession.getState().accessToken) return;
  const auth = await refreshSession();
  if (!auth) throw redirect({ to: '/login', search: { redirect: redirectTo } });
}

/** Route-level permission guard (the API enforces it too). */
export function requireModule(module: ModuleCode) {
  return () => {
    if (!hasPermission(useSession.getState().me, module)) throw redirect({ to: '/' });
  };
}

/** Only allow same-app relative redirects (prevents open redirects). */
export function safeRedirect(target: string | undefined) {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
}
