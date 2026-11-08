import { useState, type ComponentProps, type ReactNode } from 'react';
import { CircleAlert, Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type AuthFieldProps = ComponentProps<'input'> & {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  hint?: string;
  children?: ReactNode;
};

export const authControlClass =
  'h-11 w-full min-w-0 border-0 bg-transparent p-0 text-[15px] font-medium text-[#1e1e1e] outline-none placeholder:text-[#a3a3a3]';

export function AuthField({
  id,
  label,
  icon: Icon,
  error,
  hint,
  type = 'text',
  className,
  children,
  ...props
}: AuthFieldProps) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('group grid gap-1.5', className)}>
      <label
        htmlFor={id}
        className={cn(
          'text-[13px] font-medium text-[#6b6b6b] transition-colors group-focus-within:text-[#1e1e1e]',
          error && 'text-[#d93b2f]',
        )}
      >
        {label}
      </label>
      <div
        className={cn(
          'relative flex items-center gap-3 border-b-2 border-[#d9d9d9] transition-colors group-focus-within:border-primary',
          error && 'border-[#d93b2f] group-focus-within:border-[#d93b2f]',
        )}
      >
        <Icon
          aria-hidden
          className={cn(
            'size-[18px] shrink-0 text-[#a3a3a3] transition-colors group-focus-within:text-primary',
            error && 'text-[#d93b2f]',
          )}
        />
        {children ?? (
          <input
            id={id}
            type={isPassword && reveal ? 'text' : type}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={authControlClass}
            {...props}
          />
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="grid size-8 shrink-0 place-items-center rounded-md text-[#8d8d8d] transition-colors hover:text-[#1e1e1e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={reveal}
          >
            {reveal ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-medium text-[#d93b2f]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-[#8d8d8d]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      key={message}
      className="flex items-start gap-2 text-[14px] font-medium leading-snug text-[#b3261e] animate-in fade-in-0 duration-200"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}
