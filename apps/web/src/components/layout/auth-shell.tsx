import type { ReactNode } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { ArrowLeftRight, FileBarChart, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2 font-bold', light && 'text-white', className)}>
      <img src="/brand/inventarioslogo.png" alt="" className="w-[38px] animate-float" />
      <span className="text-lg tracking-tight">StockPRO</span>
    </div>
  );
}

const FEATURES = [
  { icon: ArrowLeftRight, text: 'Kardex de entradas y salidas en tiempo real' },
  { icon: FileBarChart, text: 'Reportes en PDF y Excel' },
  { icon: ShieldCheck, text: 'Tu equipo con permisos por módulo' },
];

const TABS = [
  { to: '/login', label: 'Iniciar sesión' },
  { to: '/register', label: 'Crear cuenta' },
] as const;

/** Direction-aware view transition between the two auth forms. */
export function authTransition(to: (typeof TABS)[number]['to']) {
  return { types: [to === '/register' ? 'auth-forward' : 'auth-back'] };
}

/**
 * Persistent layout for login/registro (original StockPRO look: orange banner with the
 * forklift, white card). Only the form inside the card changes between routes.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const active = TABS.findIndex((t) => pathname.startsWith(t.to));

  return (
    <div className="grid min-h-dvh bg-[#262626] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* ---------- Brand panel ---------- */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#fc6b32] via-[#f76f3a] to-[#ec580e] p-10 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="bg-grid absolute inset-0 opacity-30 [--grid-line:rgba(255,255,255,0.18)]"
        />
        <span
          aria-hidden
          className="absolute -left-24 -top-24 size-72 rounded-full bg-[#f7b272] opacity-40 blur-sm"
        />
        <span
          aria-hidden
          className="absolute -bottom-32 -right-24 size-96 rounded-full bg-[#f7b272] opacity-30 blur-sm"
        />

        <Logo light className="relative" />

        <div className="relative flex flex-1 items-center justify-center py-6">
          <img
            src="/brand/carrito.svg"
            alt=""
            className="w-[min(78%,440px)] animate-float drop-shadow-[0_25px_25px_rgba(0,0,0,0.25)] [animation-duration:2.6s]"
          />
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">
            Controla tu inventario
            <br />
            desde cualquier dispositivo.
          </h2>
          <ul className="mt-6 grid gap-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px] text-white/90">
                <span className="grid size-8 place-items-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ---------- Form side (always light, like the original card) ---------- */}
      <main className="theme-light relative flex min-h-dvh flex-col bg-white bg-[url('/brand/estrellacuadros.svg')] bg-cover bg-center text-[#202020]">
        {/* Mobile header strip */}
        <div className="flex items-center justify-between bg-gradient-to-r from-[#fc6b32] to-[#f76f3a] px-5 py-4 lg:hidden">
          <Logo light />
          <img src="/brand/carrito.svg" alt="" className="h-10" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <div className="auth-card w-full max-w-[440px] rounded-[20px] border border-black/5 bg-white/90 p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.25)] backdrop-blur-sm sm:p-9">
            <div className="mb-6 text-center">
              <h1 className="text-[40px] font-extrabold leading-none tracking-tight">StockPRO</h1>
              <p className="mt-2 text-lg font-bold text-[#fc6c32]">Controla tu inventario.</p>
            </div>

            {/* Segmented tabs with a sliding indicator */}
            <nav
              aria-label="Acceso"
              className="relative mb-7 grid grid-cols-2 rounded-xl bg-[#f2f2f2] p-1 text-sm font-semibold"
            >
              <span
                aria-hidden
                className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg border-2 border-black bg-primary shadow-[2px_2px_0_#000] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
                style={{ transform: `translateX(${Math.max(active, 0) * 100}%)` }}
              />
              {TABS.map((t, i) => (
                <Link
                  key={t.to}
                  to={t.to}
                  viewTransition={authTransition(t.to)}
                  aria-current={i === active ? 'page' : undefined}
                  className={cn(
                    'relative z-10 rounded-lg py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    i === active ? 'text-black' : 'text-[#6b6b6b] hover:text-black',
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>

            <div className="auth-form">{children}</div>
          </div>
        </div>

        <footer className="pb-6 text-center text-xs text-[#8d8d8d]">
          © {new Date().getFullYear()} StockPRO · Puedes crear una cuenta nueva o solicitarla a tu
          empleador.
        </footer>
      </main>
    </div>
  );
}
