import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppShell } from '@/components/layout/app-shell';
import { RouteError } from '@/components/layout/route-error';
import { ensureSession } from '@/lib/guards';

export const Route = createFileRoute('/_app')({
  beforeLoad: ({ location }) => ensureSession(location.href),
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  errorComponent: RouteError,
});
