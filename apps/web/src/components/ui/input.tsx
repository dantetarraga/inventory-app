import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export const fieldClass = cn(
  'w-full rounded-lg border border-field-border bg-field px-3 text-[14px] text-foreground shadow-xs outline-none',
  'transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70',
  'hover:border-field-hover',
  'focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20',
  'aria-invalid:border-destructive aria-invalid:ring-destructive/15 aria-invalid:focus-visible:ring-[3px]',
  'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
);

type InputProps = React.ComponentProps<'input'> & {
  leadingIcon?: React.ReactNode;
};

export function Input({ className, type, leadingIcon, ...props }: InputProps) {
  const input = (
    <input
      type={type}
      className={cn(fieldClass, 'h-10', leadingIcon && 'pl-9', !leadingIcon && className)}
      {...props}
    />
  );
  if (!leadingIcon) return input;
  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
        {leadingIcon}
      </span>
      {input}
    </div>
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldClass, 'min-h-20 resize-y py-2', className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('text-[13px] font-medium leading-none text-foreground', className)}
      {...props}
    />
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, error, hint, optional, className, children }: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  const control = React.isValidElement<Record<string, unknown>>(children)
    ? React.cloneElement(children, {
        id: htmlFor,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {control}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="text-[12.5px] font-medium text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[12.5px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
