import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AuthShell } from '@/components/layout/auth-shell';
import { refreshSession } from '@/lib/http';
import { safeRedirect } from '@/lib/guards';
import { useSession } from '@/stores/session';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ location }) => {
    if (useSession.getState().accessToken || (await refreshSession())) {
      const target = new URLSearchParams(location.searchStr).get('redirect') ?? undefined;
      throw redirect({ to: safeRedirect(target) });
    }
  },
  component: () => (
    <AuthShell>
      <Outlet />
    </AuthShell>
  ),
});
