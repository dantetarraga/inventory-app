import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronRight, CircleHelp, LogOut, Menu, Monitor, Moon, Sun, X } from 'lucide-react';
import { ROLE_LABELS, type Theme } from '@stockpro/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authApi } from '@/features/api';
import { cn } from '@/lib/utils';
import { hasPermission, useSession } from '@/stores/session';
import { useTheme } from '@/stores/theme';
import { Logo } from './auth-shell';
import { MAIN_NAV, SECONDARY_NAV, type NavItem } from './nav';

const SIDEBAR_KEY = 'stockpro-sidebar-open';

function readSidebarOpen() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** Persists the theme locally and in the user profile. */
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
    await navigate({ to: '/login', viewTransition: true });
  };
}

/** Sidebar link in the original style: orange text + 4px orange bar when active. */
function SideLink({
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
      className="relative flex h-[60px] items-center text-foreground transition-colors hover:bg-accent"
      activeProps={{
        className:
          '!text-primary font-semibold before:absolute before:left-0 before:h-full before:w-1 before:rounded-[10px] before:bg-primary',
      }}
    >
      <span className="flex shrink-0 px-[20px]">
        <Icon className="size-[25px]" aria-hidden />
      </span>
      <span
        className={cn(
          'whitespace-nowrap transition-opacity duration-300',
          open ? 'opacity-100' : 'sr-only',
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

function NavLinks({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  const me = useSession((s) => s.me);
  const visible = (items: NavItem[]) =>
    items.filter((i) => !i.module || hasPermission(me, i.module));
  return (
    <nav aria-label="Principal">
      {visible(MAIN_NAV).map((item) => (
        <SideLink key={item.to} item={item} open={open} onNavigate={onNavigate} />
      ))}
      <div className="my-6 h-px bg-muted" />
      {visible(SECONDARY_NAV).map((item) => (
        <SideLink key={item.to} item={item} open={open} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

/** Sun/moon switch from the original sidebar ("ToggleTema"). */
function ThemeToggle({ open }: { open: boolean }) {
  const { theme, change } = useThemeChanger();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <div className={cn('flex items-center py-4', open ? 'gap-3 px-[20px]' : 'justify-center')}>
      {open && <span className="text-sm text-muted-foreground">{isDark ? 'Oscuro' : 'Claro'}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Modo oscuro"
        onClick={() => change(isDark ? 'light' : 'dark')}
        className="relative h-7 w-[52px] shrink-0 rounded-full bg-[#f9743b] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-[rgb(52,131,235)]"
      >
        <span
          className={cn(
            'absolute top-0.5 grid size-6 place-items-center rounded-full bg-white text-xs shadow transition-transform',
            isDark ? 'translate-x-[26px]' : 'translate-x-0.5',
          )}
        >
          {isDark ? '🌚' : '🌞'}
        </span>
      </button>
    </div>
  );
}

/** Orange "Cerrar sesión" card from the original sidebar. */
function LogoutCard() {
  const logout = useLogout();
  return (
    <div className="relative w-full p-4 text-center">
      <CircleHelp
        className="absolute left-1/2 top-0 z-10 size-12 -translate-x-1/2 rounded-full bg-sidebar p-1"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-[10px] bg-primary p-4">
        <span className="absolute -left-[50px] -top-[50px] size-[100px] rounded-full bg-brand-soft opacity-70" />
        <span className="absolute -bottom-[80px] -right-[70px] size-[130px] rounded-full bg-brand-soft opacity-70" />
        <h3 className="relative mt-4 py-4 text-lg font-extrabold text-black">Cerrar sesión</h3>
        <Button className="relative bg-[#f8f2fd]" onClick={() => void logout()}>
          Cerrar …
        </Button>
      </div>
    </div>
  );
}

function Sidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col overflow-y-auto overflow-x-hidden bg-sidebar pt-5 text-foreground transition-[width] duration-100 md:flex',
        open ? 'w-[220px]' : 'w-[65px]',
      )}
    >
      <div className="flex items-center justify-center gap-2 pb-[60px]">
        <img
          src="/brand/inventarioslogo.png"
          alt=""
          className={cn(
            'w-[30px] animate-float transition-transform duration-300',
            open ? 'scale-[0.9]' : 'scale-150',
          )}
        />
        {open && <h2 className="text-xl font-bold">StockPRO</h2>}
      </div>
      <NavLinks open={open} />
      <ThemeToggle open={open} />
      <div className="my-6 h-px bg-muted" />
      {open && <LogoutCard />}
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Contraer menú' : 'Expandir menú'}
        aria-expanded={open}
        className={cn(
          'fixed top-[70px] z-50 grid size-8 place-items-center rounded-full bg-sidebar-toggle text-foreground shadow-[0_0_4px_var(--popover),0_0_7px_var(--sidebar)] transition-all duration-200',
          open ? 'left-[204px] rotate-180' : 'left-[42px]',
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </aside>
  );
}

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

/** Avatar pill in the top-right ("DataUser" in the original). */
function UserMenu() {
  const me = useSession((s) => s.me);
  const { theme, change } = useThemeChanger();
  const logout = useLogout();
  if (!me) return null;
  const initials = me.user.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex max-w-[220px] items-center gap-3 rounded-full p-2 pr-4 text-sm transition-colors hover:bg-popover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Menú de usuario"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-black">
            {initials}
          </span>
          <span className="hidden truncate font-medium sm:block">{me.user.fullName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="truncate">{me.user.fullName}</div>
          <div className="truncate text-xs font-normal text-muted-foreground">{me.user.email}</div>
          <div className="mt-1 text-xs font-normal text-muted-foreground">
            {ROLE_LABELS[me.user.role]} · {me.company.name}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Tema
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => change(v as Theme)}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden /> {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut aria-hidden /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen);
  const me = useSession((s) => s.me);
  const setTheme = useTheme((s) => s.setTheme);

  // Adopt the theme saved in the user's profile after login.
  const serverTheme = me?.user.theme;
  useEffect(() => {
    if (serverTheme) setTheme(serverTheme);
  }, [serverTheme, setTheme]);

  const toggleSidebar = () =>
    setSidebarOpen((o) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, String(!o));
      } catch {
        /* storage unavailable */
      }
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

      <Sidebar open={sidebarOpen} onToggle={toggleSidebar} />

      {/* Mobile drawer ("Menuambur" in the original) */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-[rgba(10,9,9,0.5)] md:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col overflow-y-auto bg-sidebar pt-4 shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-left md:hidden">
            <DialogPrimitive.Title className="sr-only">Navegación</DialogPrimitive.Title>
            <div className="mb-6 flex items-center justify-between px-4">
              <Logo />
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Cerrar menú">
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <NavLinks open onNavigate={() => setMobileOpen(false)} />
            <ThemeToggle open />
            <LogoutCard />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div
        className={cn(
          'flex min-h-dvh min-w-0 flex-col transition-[padding] duration-100',
          sidebarOpen ? 'md:pl-[220px]' : 'md:pl-[65px]',
        )}
      >
        <header className="sticky top-0 z-30 flex h-[76px] items-center gap-2 bg-background/85 px-4 backdrop-blur md:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="!size-6" />
          </Button>
          <span className="truncate text-sm font-medium md:hidden">{me?.company.name}</span>
          <div className="ml-auto">
            <UserMenu />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-10 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
