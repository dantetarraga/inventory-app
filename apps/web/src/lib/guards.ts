import { redirect } from '@tanstack/react-router';
import type { ModuleCode } from '@stockpro/shared';
import { refreshSession } from './http';
import { hasPermission, useSession } from '@/stores/session';

export async function ensureSession(redirectTo: string) {
  if (useSession.getState().accessToken) return;
  const auth = await refreshSession();
  if (!auth) throw redirect({ to: '/login', search: { redirect: redirectTo } });
}

export function requireModule(module: ModuleCode) {
  return () => {
    if (!hasPermission(useSession.getState().me, module)) throw redirect({ to: '/' });
  };
}

export function safeRedirect(target: string | undefined) {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
}
