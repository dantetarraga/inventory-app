import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { upsertBrandSchema, type Brand, type UpsertBrandInput } from '@stockpro/shared';
import { listSearchSchema, PAGE_SIZE, RowActions, useEditor } from '@/components/crud';
import { Button } from '@/components/ui/button';
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
import { brandsApi } from '@/features/api';
import { requireModule } from '@/lib/guards';
import { applyServerErrors } from '@/lib/query';

export const Route = createFileRoute('/_app/settings/brands')({
  beforeLoad: requireModule('brands'),
  validateSearch: listSearchSchema,
  component: BrandsPage,
});

function BrandsPage() {
  const { page = 1, q = '' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isLoading } = useQuery(brandsApi.listOptions({ page, pageSize: PAGE_SIZE, q }));
  const remove = brandsApi.useRemove();
  const editor = useEditor<Brand>();

  const columns = useMemo<ColumnDef<Brand, unknown>[]>(
    () => [
      {
        header: 'Nombre',
        accessorKey: 'name',
        cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span>,
      },
      { header: 'Productos', accessorKey: 'productCount', meta: { className: 'text-right w-28' } },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        meta: { className: 'w-24' },
        cell: ({ row }) => (
          <RowActions
            onEdit={() => editor.openEdit(row.original)}
            onDelete={() => remove.mutateAsync(row.original.id)}
            deleting={remove.isPending}
            deleteTitle="Eliminar marca"
            deleteDescription={`¿Eliminar "${row.original.name}"?`}
          />
        ),
      },
    ],
    [editor, remove],
  );

  return (
    <>
      <PageHeader
        title="Marcas"
        description="Las marcas de los productos que manejas."
        actions={
          <Button onClick={editor.openNew}>
            <Plus /> Nueva marca
          </Button>
        }
      />
      <SearchInput
        className="mb-4"
        value={q}
        onChange={(value) => navigate({ search: { q: value || undefined, page: undefined } })}
        placeholder="Buscar marca…"
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
      <BrandDialog
        key={editor.item?.id ?? 'new'}
        open={editor.isOpen}
        item={editor.item}
        onClose={editor.close}
      />
    </>
  );
}

function BrandDialog({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: Brand | null;
  onClose: () => void;
}) {
  const create = brandsApi.useCreate();
  const update = brandsApi.useUpdate();
  const form = useForm<UpsertBrandInput>({
    resolver: zodResolver(upsertBrandSchema),
    defaultValues: { name: item?.name ?? '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (item) await update.mutateAsync({ id: item.id, body: values });
      else await create.mutateAsync(values);
      onClose();
    } catch (err) {
      applyServerErrors(err, form.setError);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{item ? 'Editar marca' : 'Nueva marca'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Nombre" htmlFor="brand-name" error={form.formState.errors.name?.message}>
            <Input autoFocus {...form.register('name')} />
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
