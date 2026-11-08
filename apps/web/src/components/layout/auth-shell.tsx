import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function authTransition(to: '/login' | '/register') {
  return { types: [to === '/register' ? 'auth-forward' : 'auth-back'] };
}

export function BrandMark({ className }: { className?: string }) {
  return <img src="/brand/inventarioslogo.png" alt="StockPRO" className={cn('w-11', className)} />;
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-[#fc6b32] lg:block">
        <BrandMark className="absolute left-12 top-10 z-10" />

        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[30%] bg-[#ee5d1f]">
          <div className="h-px bg-white/30" />
        </div>

        <div
          aria-hidden
          className="absolute inset-x-0 bottom-[30%] flex translate-y-[24%] justify-center"
        >
          <div className="relative w-[min(76%,520px)]">
            <span className="absolute bottom-[2%] left-[6%] h-[10%] w-[86%] rounded-[50%] bg-[#9a3208]/35 blur-[10px]" />
            <img src="/brand/carrito.svg" alt="" className="relative w-full animate-drive-in" />
          </div>
        </div>
      </aside>

      <main className="theme-light flex min-h-dvh flex-col bg-white text-[#1e1e1e]">
        <header className="flex items-center bg-[#fc6b32] px-6 py-3 lg:hidden">
          <BrandMark className="w-9" />
        </header>
        <div className="flex flex-1 items-center px-6 py-12 sm:px-12 lg:px-20">
          <div className="auth-form w-full max-w-[380px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
