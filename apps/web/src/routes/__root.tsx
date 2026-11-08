import { lazy, Suspense } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { ToastViewport } from '@/plugins/toast.plugin';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/stores/theme';

const Devtools = import.meta.env.DEV
  ? lazy(() =>
      Promise.all([
        import('@tanstack/react-router-devtools'),
        import('@tanstack/react-query-devtools'),
      ]).then(([router, query]) => ({
        default: () => (
          <>
            <router.TanStackRouterDevtools position="bottom-right" />
            <query.ReactQueryDevtools buttonPosition="bottom-left" />
          </>
        ),
      })),
    )
  : () => null;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  const theme = useTheme((s) => s.theme);
  return (
    <>
      <Outlet />
      <ToastViewport theme={theme} />
      <Suspense>
        <Devtools />
      </Suspense>
    </>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Página no encontrada</h1>
        <Button asChild className="mt-6">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
