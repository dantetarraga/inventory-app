import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/query';
import { AppShell } from './app-shell';

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <AppShell>
      <div
        role="alert"
        className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-6 text-center"
      >
        <AlertTriangle className="mx-auto size-8 text-destructive" aria-hidden />
        <h2 className="mt-3 font-semibold">Algo salió mal</h2>
        <p className="mt-1 text-sm text-muted-foreground">{errorMessage(error)}</p>
        <Button
          className="mt-4"
          onClick={() => {
            reset();
            void router.invalidate();
          }}
        >
          Reintentar
        </Button>
      </div>
    </AppShell>
  );
}
