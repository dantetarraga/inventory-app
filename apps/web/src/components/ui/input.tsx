import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

/**
 * Two field styles from the original app:
 * - `underline` (forms): bottom border that turns orange on focus.
 * - `box` (toolbars / filters): bordered, rounded box like the original "Buscador".
 */
type FieldVariant = 'underline' | 'box';

const base =
  'flex w-full text-[15px] transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';
const variants: Record<FieldVariant, string> = {
  underline:
    'rounded-none border-0 border-b-2 border-input bg-transparent px-0 py-1.5 focus-visible:border-primary focus-visible:font-semibold aria-invalid:border-destructive',
  box: 'rounded-[10px] border border-border bg-sidebar px-3 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25',
};

type WithVariant<T> = T & { variant?: FieldVariant };

export function Input({
  className,
  type,
  variant = 'underline',
  ...props
}: WithVariant<React.ComponentProps<'input'>>) {
  return (
    <input type={type} className={cn(base, variants[variant], 'h-10', className)} {...props} />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea className={cn(base, variants.underline, 'min-h-16 resize-y', className)} {...props} />
  );
}

/** Native select: accessible, keyboard friendly and works well on mobile. */
export function Select({
  className,
  variant = 'underline',
  ...props
}: WithVariant<React.ComponentProps<'select'>>) {
  return (
    <select
      className={cn(
        base,
        variants[variant],
        'h-10 pr-8 [&>option]:bg-popover [&>option]:text-popover-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-sm font-medium leading-none text-muted-foreground peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + error message, wired with aria-describedby. Label turns orange on focus. */
export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  const control = React.isValidElement<Record<string, unknown>>(children)
    ? React.cloneElement(children, {
        id: htmlFor,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;
  return (
    <div className={cn('group grid gap-1', className)}>
      <Label
        htmlFor={htmlFor}
        className="transition-colors group-focus-within:font-semibold group-focus-within:text-primary"
      >
        {label}
      </Label>
      {control}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-[#f46943]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
