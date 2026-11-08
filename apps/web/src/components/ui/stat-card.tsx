import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  hint?: ReactNode;
  tone?: 'default' | 'warning';
  emphasis?: boolean;
  to?: string;
  search?: Record<string, string | number | boolean | undefined>;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  emphasis,
  to,
  search,
  className,
}: StatCardProps) {
  const body = (
    <div
      className={cn(
        'group relative flex h-full flex-col justify-between gap-3 rounded-[10px] border bg-card p-5 transition-colors',
        tone === 'warning' ? 'border-warning/40' : 'border-transparent dark:border-white/5',
        to && 'hover:border-primary/60',
        !to && className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {to && (
          <ArrowUpRight
            aria-hidden
            className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
          />
        )}
      </div>
      <div>
        <p
          className={cn(
            'tabular font-display font-semibold leading-none tracking-tight',
            emphasis ? 'text-[36px]' : 'text-[28px]',
            tone === 'warning' && 'text-amber-600 dark:text-warning',
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-2 text-[13px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );

  return to ? (
    <Link
      to={to}
      search={search as never}
      viewTransition
      className={cn(
        'block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {body}
    </Link>
  ) : (
    body
  );
}
