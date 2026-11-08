import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Search, X } from 'lucide-react';
import type { Product } from '@stockpro/shared';
import { Input } from '@/components/ui/input';
import { productsApi } from '@/features/api';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ProductPicker({
  value,
  onChange,
  invalid,
  id,
}: {
  value: Product | null;
  onChange: (p: Product | null) => void;
  invalid?: boolean;
  id?: string;
}) {
  const listId = useId();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isFetching } = useQuery({
    ...productsApi.listOptions({ q: debounced, pageSize: 8, page: 1 }),
    enabled: open,
  });
  const items = data?.items ?? [];

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border bg-accent/50 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{value.name}</div>
          <div className="text-xs text-muted-foreground">
            Stock actual: <strong>{formatNumber(value.stock)}</strong>
            {value.internalCode && ` · ${value.internalCode}`}
          </div>
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
          onClick={() => onChange(null)}
          aria-label="Cambiar producto"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  const select = (p: Product) => {
    onChange(p);
    setOpen(false);
    setTerm('');
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        aria-activedescendant={open && items[active] ? `${listId}-${items[active].id}` : undefined}
        className="pl-8"
        placeholder="Busca por nombre o código…"
        value={term}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setTerm(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, items.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && open && items[active]) {
            e.preventDefault();
            select(items[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {items.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {isFetching ? 'Buscando…' : 'Sin resultados'}
            </li>
          ) : (
            items.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(p)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded px-3 py-2 text-sm',
                  i === active && 'bg-accent text-accent-foreground',
                )}
              >
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatNumber(p.stock)} u.
                  {i === active && <Check className="ml-1 inline size-3" aria-hidden />}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
