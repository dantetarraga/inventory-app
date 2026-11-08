import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowDownToLine, ArrowUpFromLine, Scale, X } from 'lucide-react';
import { z } from 'zod';
import {
  decimalString,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPES,
  type Movement,
  type MovementType,
  type Product,
} from '@stockpro/shared';
import { listSearchSchema, PAGE_SIZE } from '@/components/crud';
import { ProductPicker } from '@/components/product-picker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { PageHeader, SearchInput } from '@/components/ui/page';
import { kardexApi, productsApi, warehousesApi } from '@/features/api';
import { formatDateTime, formatNumber } from '@/lib/format';
import { requireModule } from '@/lib/guards';
import { applyServerErrors } from '@/lib/query';

const searchSchema = listSearchSchema.extend({
  productId: z.coerce.number().int().positive().optional().catch(undefined),
  type: z.enum(MOVEMENT_TYPES).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
});

export const Route = createFileRoute('/_app/kardex')({
  beforeLoad: requireModule('kardex'),
  validateSearch: searchSchema,
  component: KardexPage,
});

const TYPE_BADGE: Record<MovementType, 'success' | 'destructive' | 'secondary'> = {
  in: 'success',
  out: 'destructive',
  adjust: 'secondary',
};

function KardexPage() {
  const search = Route.useSearch();
  const { page = 1, q = '', productId, type, from, to } = search;
  const navigate = Route.useNavigate();
  const [dialogType, setDialogType] = useState<MovementType | null>(null);
  const { data, isLoading } = useQuery(
    kardexApi.listOptions({ page, pageSize: PAGE_SIZE, q, productId, type, from, to }),
  );
  const { data: filterProduct } = useQuery({
    ...productsApi.detailOptions(productId ?? 0),
    enabled: !!productId,
  });
  const { data: warehouses } = useQuery(warehousesApi.listOptions({ page: 1, pageSize: 100 }));
  const multiWarehouse = (warehouses?.items.length ?? 0) > 1;

  const columns = useMemo<ColumnDef<Movement, unknown>[]>(
    () => [
      {
        header: 'Fecha',
        accessorKey: 'occurredAt',
        meta: { className: 'whitespace-nowrap' },
        cell: ({ getValue }) => formatDateTime(getValue() as string),
      },
      {
        header: 'Producto',
        id: 'product',
        cell: ({ row }) => (
          <div className="min-w-40">
            <div className="font-medium">{row.original.product.name}</div>
            {multiWarehouse && (
              <div className="text-xs text-muted-foreground">{row.original.warehouse.name}</div>
            )}
          </div>
        ),
      },
      {
        header: 'Tipo',
        accessorKey: 'type',
        cell: ({ row }) => (
          <Badge variant={TYPE_BADGE[row.original.type]}>
            {MOVEMENT_TYPE_LABELS[row.original.type]}
          </Badge>
        ),
      },
      {
        header: 'Cantidad',
        accessorKey: 'delta',
        meta: { className: 'text-right whitespace-nowrap' },
        cell: ({ getValue }) => {
          const n = Number(getValue());
          return (
            <span className={n > 0 ? 'text-success' : 'text-destructive'}>
              {n > 0 ? '+' : '−'}
              {formatNumber(Math.abs(n))}
            </span>
          );
        },
      },
      {
        header: 'Saldo',
        accessorKey: 'balanceAfter',
        meta: { className: 'text-right font-medium' },
        cell: ({ getValue }) => formatNumber(getValue() as string),
      },
      { header: 'Usuario', id: 'user', cell: ({ row }) => row.original.user.fullName },
      {
        header: 'Detalle',
        accessorKey: 'note',
        cell: ({ getValue }) => (
          <span className="line-clamp-2 max-w-60 text-muted-foreground">
            {(getValue() as string | null) ?? '—'}
          </span>
        ),
      },
    ],
    [multiWarehouse],
  );

  const setSearch = (patch: Partial<typeof search>) =>
    navigate({ search: (s) => ({ ...s, ...patch, page: undefined }) });

  return (
    <>
      <PageHeader
        title="Kardex"
        description="Historial inmutable de entradas, salidas y ajustes de stock."
        actions={
          <>
            <Button onClick={() => setDialogType('in')}>
              <ArrowDownToLine /> Entrada
            </Button>
            <Button variant="outline" onClick={() => setDialogType('out')}>
              <ArrowUpFromLine /> Salida
            </Button>
            <Button variant="ghost" onClick={() => setDialogType('adjust')}>
              <Scale /> Ajuste
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <SearchInput
          value={q}
          onChange={(value) => setSearch({ q: value || undefined })}
          placeholder="Producto o detalle…"
        />
        <Select
          variant="box"
          className="h-[52px] w-40"
          aria-label="Tipo de movimiento"
          value={type ?? ''}
          onChange={(e) =>
            setSearch({ type: (e.target.value || undefined) as MovementType | undefined })
          }
        >
          <option value="">Todos los tipos</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          variant="box"
          className="h-[52px] w-40"
          aria-label="Desde"
          value={from ?? ''}
          max={to}
          onChange={(e) => setSearch({ from: e.target.value || undefined })}
        />
        <Input
          type="date"
          variant="box"
          className="h-[52px] w-40"
          aria-label="Hasta"
          value={to ?? ''}
          min={from}
          onChange={(e) => setSearch({ to: e.target.value || undefined })}
        />
        {productId && (
          <Badge variant="outline" className="h-9 rounded-md px-3 text-sm">
            {filterProduct?.name ?? 'Producto'}
            <button
              type="button"
              onClick={() => setSearch({ productId: undefined })}
              aria-label="Quitar filtro de producto"
            >
              <X className="size-3.5" />
            </button>
          </Badge>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.items}
        loading={isLoading}
        total={data?.total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={(p) => navigate({ search: (s) => ({ ...s, page: p }) })}
        getRowId={(r) => String(r.id)}
        emptyMessage="No hay movimientos para los filtros elegidos"
      />

      {dialogType && (
        <MovementDialog
          type={dialogType}
          initialProduct={filterProduct ?? null}
          warehouses={warehouses?.items ?? []}
          onClose={() => setDialogType(null)}
        />
      )}
    </>
  );
}

const formSchema = z.object({
  quantity: decimalString(3),
  warehouseId: z.string(),
  unitCost: z.string().trim(),
  note: z.string().trim().max(300),
});
type FormIn = z.input<typeof formSchema>;
type FormOut = z.output<typeof formSchema>;

const DIALOG_COPY: Record<MovementType, { title: string; qty: string; description: string }> = {
  in: {
    title: 'Registrar entrada',
    qty: 'Cantidad que ingresa',
    description: 'Compras, devoluciones de clientes, producción…',
  },
  out: {
    title: 'Registrar salida',
    qty: 'Cantidad que sale',
    description: 'Ventas, mermas, consumo interno…',
  },
  adjust: {
    title: 'Ajuste de inventario',
    qty: 'Stock contado',
    description: 'Indica el stock físico contado; se registrará la diferencia.',
  },
};

function MovementDialog({
  type,
  initialProduct,
  warehouses,
  onClose,
}: {
  type: MovementType;
  initialProduct: Product | null;
  warehouses: Array<{ id: number; name: string; isDefault: boolean }>;
  onClose: () => void;
}) {
  const create = kardexApi.useCreate();
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [productError, setProductError] = useState<string>();
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(formSchema),
    defaultValues: { quantity: '', warehouseId: '', unitCost: '', note: '' },
  });
  const { errors } = form.formState;
  const copy = DIALOG_COPY[type];

  const onSubmit = form.handleSubmit(async (values) => {
    if (!product) {
      setProductError('Selecciona un producto');
      return;
    }
    try {
      await create.mutateAsync({
        type,
        productId: product.id,
        quantity: values.quantity,
        warehouseId: values.warehouseId ? Number(values.warehouseId) : undefined,
        unitCost: values.unitCost || null,
        note: values.note || null,
      });
      onClose();
    } catch (err) {
      applyServerErrors(err, form.setError);
    }
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <label htmlFor="mv-product" className="text-sm font-medium">
              Producto
            </label>
            <ProductPicker
              id="mv-product"
              value={product}
              invalid={!!productError}
              onChange={(p) => {
                setProduct(p);
                setProductError(undefined);
              }}
            />
            {productError && (
              <p className="text-xs text-destructive" role="alert">
                {productError}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={copy.qty} htmlFor="mv-qty" error={errors.quantity?.message}>
              <Input inputMode="decimal" {...form.register('quantity')} />
            </Field>
            {type === 'in' && (
              <Field
                label="Costo unitario (opcional)"
                htmlFor="mv-cost"
                error={errors.unitCost?.message}
              >
                <Input inputMode="decimal" placeholder="0.00" {...form.register('unitCost')} />
              </Field>
            )}
            {warehouses.length > 1 && (
              <Field label="Almacén" htmlFor="mv-wh" error={errors.warehouseId?.message}>
                <Controller
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <Select {...field}>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.isDefault ? '' : w.id}>
                          {w.name}
                          {w.isDefault ? ' (predeterminado)' : ''}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </Field>
            )}
          </div>
          <Field label="Detalle (opcional)" htmlFor="mv-note" error={errors.note?.message}>
            <Textarea rows={2} {...form.register('note')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
