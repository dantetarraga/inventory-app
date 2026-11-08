import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-transparent bg-card text-card-foreground dark:border-white/5',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 p-5 pb-4', className)}>
      <div className="grid min-w-0 gap-1">
        <h3 className="text-[16px] font-semibold leading-tight">{title}</h3>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px] font-medium ring-1 ring-inset [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary ring-primary/25',
        secondary: 'bg-muted text-muted-foreground ring-border',
        success: 'bg-success/10 text-success ring-success/25',
        warning: 'bg-warning/15 text-amber-700 ring-warning/35 dark:text-warning',
        destructive: 'bg-destructive/10 text-destructive ring-destructive/25',
        outline: 'text-muted-foreground ring-border',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}
