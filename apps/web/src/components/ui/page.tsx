import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Search box with debounce, used by every list screen. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar…',
  className,
  delay = 300,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  delay?: number;
}) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => setLocal(value), [value]);
  React.useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), delay);
    return () => clearTimeout(t);
  }, [local, value, onChange, delay]);

  return (
    <div className={cn('relative w-full sm:max-w-sm', className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        variant="box"
        className="h-[52px] pl-11 text-base"
      />
    </div>
  );
}
