import { useState, type ComponentProps, type ReactNode } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type FloatingFieldProps = Omit<ComponentProps<'input'>, 'placeholder'> & {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  hint?: string;
  /** Rendered instead of an <input> (e.g. a <select>); must accept the same id. */
  children?: ReactNode;
};

/**
 * Underlined field with a floating label and an animated orange underline,
 * inspired by the original StockPRO "InputText". Handles browser autofill
 * (label floats, no colored background) and offers show/hide for passwords.
 */
export function FloatingField({
  id,
  label,
  icon: Icon,
  error,
  hint,
  type = 'text',
  className,
  children,
  ...props
}: FloatingFieldProps) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn('group relative', className)}>
      <div className="relative">
        <Icon
          aria-hidden
          className={cn(
            'pointer-events-none absolute bottom-3 left-0 size-[18px] text-[#9b9b9b] transition-colors group-focus-within:text-primary',
            error && 'text-destructive',
          )}
        />
        {children ?? (
          <input
            id={id}
            type={isPassword && reveal ? 'text' : type}
            placeholder=" "
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'peer h-14 w-full border-0 border-b-2 border-[#d6d6d6] bg-transparent pb-1.5 pl-7 pt-5 text-[15px] font-medium text-[#202020] outline-none transition-colors',
              'focus:border-transparent aria-invalid:border-destructive',
              isPassword && 'pr-10',
            )}
            {...props}
          />
        )}
        <label
          htmlFor={id}
          className={cn(
            'pointer-events-none absolute left-7 top-1/2 max-w-[calc(100%-1.75rem)] origin-left -translate-y-1/2 truncate whitespace-nowrap text-[15px] text-[#8d8d8d] transition-all duration-200',
            // floated state: focused, filled, or autofilled
            'peer-focus:top-2.5 peer-focus:scale-[0.82] peer-focus:font-semibold peer-focus:text-primary',
            'peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:scale-[0.82]',
            'peer-autofill:top-2.5 peer-autofill:scale-[0.82]',
            children && 'top-2.5 scale-[0.82]',
            error && '!text-destructive',
          )}
        >
          {label}
        </label>
        {/* Animated gradient underline (original: linear-gradient(#ec580e, #f23505)) */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-[#ec580e] to-[#f23505] transition-transform duration-300 group-focus-within:scale-x-100"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="absolute bottom-2 right-0 grid size-8 place-items-center rounded-md text-[#8d8d8d] transition-colors hover:text-[#202020] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={reveal}
          >
            {reveal ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        )}
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-xs font-medium text-destructive animate-in fade-in-0 slide-in-from-top-1"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-[#8d8d8d]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Non-field error from the server (e.g. wrong credentials), with a short shake. */
export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      key={message}
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive animate-shake"
    >
      {message}
    </div>
  );
}
