import { createFileRoute, Link } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { SETTINGS_NAV, type NavItem } from '@/components/layout/nav';
import { cn } from '@/lib/utils';
import { hasPermission, useSession } from '@/stores/session';

export const Route = createFileRoute('/_app/settings/')({ component: SettingsIndex });

function SettingsIndex() {
  const me = useSession((s) => s.me);
  return (
    <div className="bg-grid -mx-4 flex min-h-[calc(100dvh-76px)] items-center justify-center px-4 py-8 md:-mx-8">
      <h1 className="sr-only">Configuración</h1>
      <ul className="flex w-full max-w-[916px] flex-wrap justify-center gap-2">
        {SETTINGS_NAV.map((item) => (
          <li key={item.to} className="w-[calc(50%-4px)] min-[1001px]:w-[300px] max-[320px]:w-full">
            <ModuleCard item={item} allowed={!item.module || hasPermission(me, item.module)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModuleCard({ item, allowed }: { item: NavItem; allowed: boolean }) {
  const Icon = item.icon;
  const body = (
    <div
      className={cn(
        'group relative flex h-[180px] flex-col rounded-[10px] border border-transparent bg-card p-2.5 transition-all duration-300 sm:h-[260px]',
        allowed ? 'hover:border-primary' : 'cursor-not-allowed hover:border-[red]',
      )}
    >
      {!allowed && (
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
          <Lock className="size-3" aria-hidden /> Sin acceso
        </span>
      )}
      <div className="flex h-[80px] items-center justify-center sm:h-[140px]">
        <Icon
          className={cn(
            'size-12 text-muted-foreground grayscale transition-all duration-300 sm:size-[72px]',
            allowed && 'group-hover:text-primary group-hover:grayscale-0',
          )}
          strokeWidth={1.4}
          aria-hidden
        />
      </div>
      <div className="flex flex-1 items-center px-2.5 sm:px-5">
        <div>
          <h2 className="text-[0.9em] font-semibold leading-5 text-card-foreground sm:text-[1.1em]">
            {item.label}
          </h2>
          <p className="mt-1 text-[0.8em] font-medium text-muted-foreground sm:mt-2 sm:text-[0.85em]">
            {item.description}
          </p>
        </div>
      </div>
    </div>
  );

  return allowed ? (
    <Link
      to={item.to}
      viewTransition
      className="block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  ) : (
    <div aria-disabled="true" title="No tienes permiso para este módulo">
      {body}
    </div>
  );
}
