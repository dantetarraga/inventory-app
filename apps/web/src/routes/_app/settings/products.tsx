import { useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, ArrowLeftRight, Plus } from 'lucide-react';
import { z } from 'zod';
import { createProductSchema, type Product } from '@stockpro/shared';
import { listSearchSchema, PAGE_SIZE, RowActions, useEditor } from '@/components/crud';
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
import { Field, Input, Select } from '@/components/ui/input';
import { PageHeader, SearchInput } from '@/components/ui/page';
import { brandsApi, categoriesApi, productsApi, warehousesApi } from '@/features/api';
import { formatNumber, useMoney } from '@/lib/format';
import { requireModule } from '@/lib/guards';
import { applyServerErrors } from '@/lib/query';
import { useCan } from '@/stores/session';

const searchSchema = listSearchSchema.extend({
  categoryId: z.coerce.number().int().positive().optional().catch(undefined),
  lowStock: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute('/_app/settings/products')({
  beforeLoad: requireModule('products'),
  validateSearch: searchSchema,
  component: ProductsPage,
});

const ALL = { page: 1, pageSize: 100 };

function ProductsPage() {
  const { page = 1, q = '', categoryId, lowStock } = Route.useSearch();
  const navigate = Route.useNavigate();
  const money = useMoney();
  const canKardex = useCan('kardex');
  const { data, isLoading } = useQuery(
    productsApi.listOptions({ page, pageSize: PAGE_SIZE, q, categoryId, lowStock }),
  );
  const { data: categories } = useQuery(categoriesApi.listOptions(ALL));
  const remove = productsApi.useRemove();
  const editor = useEditor<Product>();

  const columns = useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      {
        header: 'Producto',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-48">
            <div className="font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">
              {[row.original.internalCode, row.original.barcode, row.original.brand?.name]
                .filter(Boolean)
                .join(' · ') || '—'}
            </div>
          </div>
        ),
      },
      {
        header: 'Categoría',
        id: 'category',
        cell: ({ row }) =>
          row.original.category ? (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className="size-2.5 rounded-full"
                style={{ background: row.original.category.color }}
                aria-hidden
              />
              {row.original.category.name}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        header: 'Stock',
        accessorKey: 'stock',
        meta: { className: 'text-right' },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {row.original.isLowStock && (
              <Badge variant="warning" title={`Mínimo: ${formatNumber(row.original.minStock)}`}>
                <AlertTriangle className="size-3" aria-hidden /> Bajo
              </Badge>
            )}
            <span className="font-medium">{formatNumber(row.original.stock)}</span>
          </span>
        ),
      },
      {
        header: 'P. compra',
        accessorKey: 'purchasePrice',
        meta: { className: 'text-right whitespace-nowrap' },
        cell: ({ getValue }) => money(getValue() as string),
      },
      {
        header: 'P. venta',
        accessorKey: 'salePrice',
        meta: { className: 'text-right whitespace-nowrap' },
        cell: ({ getValue }) => money(getValue() as string),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        meta: { className: 'w-32' },
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            {canKardex && (
              <Button variant="ghost" size="icon" className="size-8" asChild>
                <Link
                  to="/kardex"
                  search={{ productId: row.original.id }}
                  aria-label="Ver kardex"
                  title="Ver kardex"
                >
                  <ArrowLeftRight />
                </Link>
              </Button>
            )}
            <RowActions
              onEdit={() => editor.openEdit(row.original)}
              onDelete={() => remove.mutateAsync(row.original.id)}
              deleting={remove.isPending}
              deleteTitle="Eliminar producto"
              deleteDescription={`"${row.original.name}" dejará de aparecer en listas. Su historial de kardex se conserva.`}
            />
          </div>
        ),
      },
    ],
    [editor, remove, money, canKardex],
  );

  return (
    <>
      <PageHeader
        title="Productos"
        description="El stock se actualiza solo mediante movimientos de kardex."
        actions={
          <Button onClick={editor.openNew}>
            <Plus /> Nuevo producto
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput
          value={q}
          onChange={(value) =>
            navigate({ search: (s) => ({ ...s, q: value || undefined, page: undefined }) })
          }
          placeholder="Nombre, código o código de barras…"
        />
        <Select
          variant="box"
          className="h-[52px] sm:w-60"
          aria-label="Filtrar por categoría"
          value={categoryId ?? ''}
          onChange={(e) =>
            navigate({
              search: (s) => ({
                ...s,
                categoryId: e.target.value ? Number(e.target.value) : undefined,
                page: undefined,
              }),
            })
          }
        >
          <option value="">Todas las categorías</option>
          {categories?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={!!lowStock}
            onChange={(e) =>
              navigate({
                search: (s) => ({ ...s, lowStock: e.target.checked || undefined, page: undefined }),
              })
            }
          />
          Solo bajo mínimo
        </label>
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
        emptyMessage={
          q || categoryId || lowStock
            ? 'Ningún producto coincide con los filtros'
            : 'Aún no registras productos'
        }
      />
      <ProductDialog
        key={editor.item?.id ?? 'new'}
        open={editor.isOpen}
        item={editor.item}
        onClose={editor.close}
      />
    </>
  );
}

/** Form values are strings (HTML inputs); the shared schema converts and validates them. */
const formSchema = createProductSchema.extend({
  brandId: z.string().transform((v) => (v ? Number(v) : null)),
  categoryId: z.string().transform((v) => (v ? Number(v) : null)),
  warehouseId: z.string().transform((v) => (v ? Number(v) : undefined)),
  initialStock: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d+(\.\d{1,3})?$/.test(v), 'Número positivo con hasta 3 decimales')
    .transform((v) => v || undefined),
});
type FormIn = z.input<typeof formSchema>;
type FormOut = z.output<typeof formSchema>;

function ProductDialog({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: Product | null;
  onClose: () => void;
}) {
  const create = productsApi.useCreate();
  const update = productsApi.useUpdate();
  const { data: brands } = useQuery({ ...brandsApi.listOptions(ALL), enabled: open });
  const { data: categories } = useQuery({ ...categoriesApi.listOptions(ALL), enabled: open });
  const { data: warehouses } = useQuery({
    ...warehousesApi.listOptions(ALL),
    enabled: open && !item,
  });

  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: item?.name ?? '',
      barcode: item?.barcode ?? '',
      internalCode: item?.internalCode ?? '',
      brandId: item?.brand ? String(item.brand.id) : '',
      categoryId: item?.category ? String(item.category.id) : '',
      salePrice: item?.salePrice ?? '',
      purchasePrice: item?.purchasePrice ?? '',
      minStock: item ? String(Number(item.minStock)) : '0',
      initialStock: '',
      warehouseId: '',
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async ({ initialStock, warehouseId, ...values }) => {
    const body = {
      ...values,
      barcode: values.barcode || null,
      internalCode: values.internalCode || null,
    };
    try {
      if (item) await update.mutateAsync({ id: item.id, body });
      else await create.mutateAsync({ ...body, initialStock, warehouseId });
      onClose();
    } catch (err) {
      applyServerErrors(err, form.setError);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          <DialogDescription>
            {item
              ? 'Para cambiar el stock registra una entrada, salida o ajuste en Kardex.'
              : 'Puedes indicar un stock inicial; se registrará como entrada en el kardex.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field
            label="Nombre"
            htmlFor="p-name"
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            <Input autoFocus {...form.register('name')} />
          </Field>
          <Field label="Código interno" htmlFor="p-code" error={errors.internalCode?.message}>
            <Input {...form.register('internalCode')} />
          </Field>
          <Field label="Código de barras" htmlFor="p-barcode" error={errors.barcode?.message}>
            <Input inputMode="numeric" {...form.register('barcode')} />
          </Field>
          <Field label="Categoría" htmlFor="p-category" error={errors.categoryId?.message}>
            <Select {...form.register('categoryId')}>
              <option value="">Sin categoría</option>
              {categories?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Marca" htmlFor="p-brand" error={errors.brandId?.message}>
            <Select {...form.register('brandId')}>
              <option value="">Sin marca</option>
              {brands?.items.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Precio de compra" htmlFor="p-buy" error={errors.purchasePrice?.message}>
            <Input inputMode="decimal" placeholder="0.00" {...form.register('purchasePrice')} />
          </Field>
          <Field label="Precio de venta" htmlFor="p-sale" error={errors.salePrice?.message}>
            <Input inputMode="decimal" placeholder="0.00" {...form.register('salePrice')} />
          </Field>
          <Field
            label="Stock mínimo"
            htmlFor="p-min"
            error={errors.minStock?.message}
            hint="Se alertará cuando el stock llegue a este valor."
          >
            <Input inputMode="decimal" {...form.register('minStock')} />
          </Field>
          {!item && (
            <>
              <Field
                label="Stock inicial (opcional)"
                htmlFor="p-initial"
                error={errors.initialStock?.message}
              >
                <Input inputMode="decimal" placeholder="0" {...form.register('initialStock')} />
              </Field>
              {(warehouses?.items.length ?? 0) > 1 && (
                <Field
                  label="Almacén del stock inicial"
                  htmlFor="p-wh"
                  error={errors.warehouseId?.message}
                >
                  <Select {...form.register('warehouseId')}>
                    <option value="">Predeterminado</option>
                    {warehouses?.items.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
