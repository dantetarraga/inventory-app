import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldClass } from './input';

export interface SelectOption {
  value: string | number;
  label: string;
}

type SelectProps = Omit<React.ComponentProps<'select'>, 'children'> & {
  options?: SelectOption[];
  placeholder?: string;
  children?: React.ReactNode;
};

export function Select({ options, placeholder, className, children, ...props }: SelectProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <select
        className={cn(
          fieldClass,
          'peer h-10 cursor-pointer appearance-none pr-9',
          '[&>option]:bg-popover [&>option]:text-popover-foreground',
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground peer-focus-visible:text-primary peer-disabled:opacity-50"
      />
    </div>
  );
}
