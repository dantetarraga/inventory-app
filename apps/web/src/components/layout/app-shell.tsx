import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { LogOut, Menu, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from 'lucide-react';
import { ROLE_LABELS, type Theme } from '@stockpro/shared';
import { IconButton } from '@/components/ui/button';
import { authApi } from '@/features/api';
import { cn } from '@/lib/utils';
import { storage } from '@/plugins/storage.plugin';
import { toast } from '@/plugins/toast.plugin';
import { hasPermission, useSession } from '@/stores/session';
import { useTheme } from '@/stores/theme';
import { BrandMark } from './auth-shell';
import { MAIN_NAV, SECONDARY_NAV, type NavItem } from './nav';

const SIDEBAR_KEY = 'sidebar-open';

const THEMES: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Tema claro', icon: Sun },
  { value: 'dark', label: 'Tema oscuro', icon: Moon },
  { value: 'system', label: 'Tema del sistema', icon: Monitor },
];

function useThemeChanger() {
  const setMe = useSession((s) => s.setMe);
  const { theme, setTheme } = useTheme();
  return {
    theme,
    change: (t: Theme) => {
      setTheme(t);
      authApi
        .updatePreferences(t)
        .then(setMe)
        .catch(() => undefined);
    },
  };
}

function useLogout() {
  const navigate = useNavigate();
  return async () => {
    await authApi.logout();
    toast.info('Sesión cerrada', { description: 'Vuelve a ingresar cuando lo necesites.' });
    await navigate({ to: '/login', viewTransition: true });
  };
}

function initials(fullName: string) {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

function NavLink({
  item,
  open,
  onNavigate,
}: {
  item: NavItem;
  open: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      viewTransition
      onClick={onNavigate}
      activeOptions={{ exact: item.to === '/' }}
      title={open ? undefined : item.label}
      className={cn(
        'group relative flex h-10 items-center gap-3 rounded-lg text-[14px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        open ? 'px-3' : 'justify-center',
      )}
      activeProps={{
        className:
          '!bg-primary/12 !text-primary before:absolute before:-left-3 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-primary',
      }}
    >
      <Icon className="size-[19px] shrink-0" aria-hidden />
      <span className={open ? 'truncate' : 'sr-only'}>{item.label}</span>
    </Link>
  );
}

function ThemeSwitcher({ open }: { open: boolean }) {
  const { theme, change } = useThemeChanger();
  if (!open) {
    const next = THEMES[(THEMES.findIndex((t) => t.value === theme) + 1) % THEMES.length]!;
    const Current = THEMES.find((t) => t.value === theme)?.icon ?? Moon;
    return (
      <IconButton
        className="mx-auto"
        label={`Cambiar a ${next.label.toLowerCase()}`}
        icon={<Current />}
        onClick={() => change(next.value)}
      />
    );
  }
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="grid grid-cols-3 gap-1 rounded-lg bg-background p-1"
    >
      {THEMES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => change(value)}
          className={cn(
            'grid h-8 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            theme === value && 'bg-card text-foreground shadow-sm',
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}

function UserBlock({ open }: { open: boolean }) {
  const me = useSession((s) => s.me);
  const logout = useLogout();
  if (!me) return null;
  return (
    <div className={cn('flex items-center gap-3', !open && 'flex-col')}>
      <span
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-display text-[13px] font-semibold text-black"
        title={open ? undefined : me.user.fullName}
        aria-hidden={open}
      >
        {initials(me.user.fullName)}
      </span>
      {open && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium leading-tight">{me.user.fullName}</p>
          <p className="truncate text-[12px] text-muted-foreground">
            {ROLE_LABELS[me.user.role]} en {me.company.name}
          </p>
        </div>
      )}
      <IconButton
        variant="danger"
        size="icon-sm"
        label="Cerrar sesión"
        icon={<LogOut />}
        onClick={() => void logout()}
      />
    </div>
  );
}

function SidebarContent({
  open,
  onNavigate,
  headerAction,
}: {
  open: boolean;
  onNavigate?: () => void;
  headerAction?: ReactNode;
}) {
  const me = useSession((s) => s.me);
  const visible = (items: NavItem[]) =>
    items.filter((i) => !i.module || hasPermission(me, i.module));
  return (
    <div className="flex h-full flex-col px-3 py-4">
      <div
        className={cn('mb-6 flex items-center', open ? 'justify-between pl-1' : 'flex-col gap-3')}
      >
        <Link to="/" viewTransition onClick={onNavigate} aria-label="Inicio">
          <BrandMark className="w-9" />
        </Link>
        {headerAction}
      </div>

      <nav aria-label="Principal" className="grid gap-1">
        {visible(MAIN_NAV).map((item) => (
          <NavLink key={item.to} item={item} open={open} onNavigate={onNavigate} />
        ))}
        <div className="my-3 h-px bg-border" />
        {visible(SECONDARY_NAV).map((item) => (
          <NavLink key={item.to} item={item} open={open} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-auto grid min-w-0 grid-cols-1 gap-4 border-t pt-4">
        <ThemeSwitcher open={open} />
        <UserBlock open={open} />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState(() => storage.get(SIDEBAR_KEY, true));
  const me = useSession((s) => s.me);
  const setTheme = useTheme((s) => s.setTheme);

  const serverTheme = me?.user.theme;
  useEffect(() => {
    if (serverTheme) setTheme(serverTheme);
  }, [serverTheme, setTheme]);

  const toggle = () =>
    setOpen((o) => {
      storage.set(SIDEBAR_KEY, !o);
      return !o;
    });

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden overflow-hidden border-r bg-sidebar transition-[width] duration-200 md:block',
          open ? 'w-[248px]' : 'w-[72px]',
        )}
      >
        <SidebarContent
          open={open}
          headerAction={
            <IconButton
              size="icon-sm"
              label={open ? 'Contraer menú' : 'Expandir menú'}
              aria-expanded={open}
              icon={open ? <PanelLeftClose /> : <PanelLeftOpen />}
              onClick={toggle}
            />
          }
        />
      </aside>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[rgba(10,9,9,0.5)] md:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-[280px] bg-sidebar shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-left md:hidden">
            <DialogPrimitive.Title className="sr-only">Navegación</DialogPrimitive.Title>
            <SidebarContent
              open
              onNavigate={() => setMobileOpen(false)}
              headerAction={
                <DialogPrimitive.Close asChild>
                  <IconButton size="icon-sm" label="Cerrar menú" icon={<X />} />
                </DialogPrimitive.Close>
              }
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div
        className={cn(
          'flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200',
          open ? 'md:pl-[248px]' : 'md:pl-[72px]',
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <IconButton label="Abrir menú" icon={<Menu />} onClick={() => setMobileOpen(true)} />
          <BrandMark className="w-8" />
          <span className="truncate text-[14px] font-medium">{me?.company.name}</span>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
