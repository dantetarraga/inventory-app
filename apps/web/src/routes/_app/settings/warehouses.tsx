import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Star } from 'lucide-react';
import { upsertWarehouseSchema, type UpsertWarehouseInput, type Warehouse } from '@stockpro/shared';
import { listSearchSchema, PAGE_SIZE, RowActions, useEditor } from '@/components/crud';
import { Button, IconButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { PageHeader, SearchInput } from '@/components/ui/page';
import { warehousesApi } from '@/features/api';
import { requireModule } from '@/lib/guards';
import { applyServerErrors } from '@/lib/query';

export const Route = createFileRoute('/_app/settings/warehouses')({
  beforeLoad: requireModule('warehouses'),
  validateSearch: listSearchSchema,
  component: WarehousesPage,
});

function WarehousesPage() {
  const { page = 1, q = '' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isLoading } = useQuery(warehousesApi.listOptions({ page, pageSize: PAGE_SIZE, q }));
  const remove = warehousesApi.useRemove();
  const setDefault = warehousesApi.useSetDefault();
  const editor = useEditor<Warehouse>();

  const columns = useMemo<ColumnDef<Warehouse, unknown>[]>(
    () => [
      {
        header: 'Nombre',
        accessorKey: 'name',
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-medium">
            {row.original.name}
            {row.original.isDefault && <Badge>Predeterminado</Badge>}
          </span>
        ),
      },
      {
        header: 'Dirección',
        accessorKey: 'address',
        cell: ({ getValue }) => (getValue() as string | null) ?? '—',
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        meta: { className: 'w-36' },
        cell: ({ row }) => (
          <div className="flex justify-end gap-0.5">
            {!row.original.isDefault && (
              <IconButton
                size="icon-sm"
                label="Marcar como predeterminado"
                icon={<Star />}
                onClick={() => setDefault.mutate(row.original.id)}
              />
            )}
            <RowActions
              onEdit={() => editor.openEdit(row.original)}
              onDelete={
                row.original.isDefault ? undefined : () => remove.mutateAsync(row.original.id)
              }
              deleting={remove.isPending}
              deleteTitle="Eliminar almacén"
              deleteDescription={`¿Eliminar "${row.original.name}"? Solo es posible si no tiene movimientos.`}
            />
          </div>
        ),
      },
    ],
    [editor, remove, setDefault],
  );

  return (
    <>
      <PageHeader
        title="Almacenes"
        description="El stock se lleva por almacén. Los movimientos usan el predeterminado si no eliges otro."
        actions={
          <Button onClick={editor.openNew}>
            <Plus /> Nuevo almacén
          </Button>
        }
      />
      <SearchInput
        className="mb-4"
        value={q}
        onChange={(value) => navigate({ search: { q: value || undefined, page: undefined } })}
        placeholder="Buscar almacén…"
      />
      <DataTable
        columns={columns}
        data={data?.items}
        loading={isLoading}
        total={data?.total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={(p) => navigate({ search: (s) => ({ ...s, page: p }) })}
        getRowId={(r) => String(r.id)}
      />
      <WarehouseDialog
        key={editor.item?.id ?? 'new'}
        open={editor.isOpen}
        item={editor.item}
        onClose={editor.close}
      />
    </>
  );
}

function WarehouseDialog({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: Warehouse | null;
  onClose: () => void;
}) {
  const create = warehousesApi.useCreate();
  const update = warehousesApi.useUpdate();
  const form = useForm<UpsertWarehouseInput>({
    resolver: zodResolver(upsertWarehouseSchema),
    defaultValues: { name: item?.name ?? '', address: item?.address ?? '' },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const body = { ...values, address: values.address || null };
    try {
      if (item) await update.mutateAsync({ id: item.id, body });
      else await create.mutateAsync(body);
      onClose();
    } catch (err) {
      applyServerErrors(err, form.setError);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{item ? 'Editar almacén' : 'Nuevo almacén'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Nombre" htmlFor="wh-name" error={errors.name?.message}>
            <Input autoFocus {...form.register('name')} />
          </Field>
          <Field label="Dirección" optional htmlFor="wh-address" error={errors.address?.message}>
            <Input {...form.register('address')} />
          </Field>
          <DialogFooter>
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
