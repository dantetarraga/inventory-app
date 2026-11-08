import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // "Btnsave" from the original: thick black border with an offset shadow.
        default:
          'border-[3px] border-black bg-primary font-extrabold text-black shadow-[0.12em_0.12em_0_#000] hover:-translate-x-px hover:-translate-y-px hover:shadow-[0.18em_0.18em_0_#000] active:translate-x-px active:translate-y-px active:shadow-[0.05em_0.05em_0_#000]',
        destructive:
          'border-[3px] border-black bg-destructive font-extrabold text-white shadow-[0.12em_0.12em_0_#000] hover:-translate-x-px hover:-translate-y-px hover:shadow-[0.18em_0.18em_0_#000]',
        outline:
          'border-[3px] border-black bg-[#f6f3f3] font-bold text-[#353535] shadow-[0.12em_0.12em_0_#000] hover:-translate-x-px hover:-translate-y-px hover:shadow-[0.18em_0.18em_0_#000]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-md px-6 text-base',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}
