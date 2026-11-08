import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import type { z } from 'zod';
import { upsertCategorySchema, type Category } from '@stockpro/shared';
import { listSearchSchema, PAGE_SIZE, RowActions, useEditor } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { PageHeader, SearchInput } from '@/components/ui/page';
import { categoriesApi } from '@/features/api';
import { requireModule } from '@/lib/guards';
import { applyServerErrors } from '@/lib/query';

export const Route = createFileRoute('/_app/settings/categories')({
  beforeLoad: requireModule('categories'),
  validateSearch: listSearchSchema,
  component: CategoriesPage,
});

const SWATCHES = [
  '#64748b',
  '#0ea5e9',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#14b8a6',
];

function CategoriesPage() {
  const { page = 1, q = '' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isLoading } = useQuery(categoriesApi.listOptions({ page, pageSize: PAGE_SIZE, q }));
  const remove = categoriesApi.useRemove();
  const editor = useEditor<Category>();

  const columns = useMemo<ColumnDef<Category, unknown>[]>(
    () => [
      {
        header: 'Nombre',
        accessorKey: 'name',
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-medium">
            <span
              className="size-3 rounded-full"
              style={{ background: row.original.color }}
              aria-hidden
            />
            {row.original.name}
          </span>
        ),
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
            deleteTitle="Eliminar categoría"
            deleteDescription={`¿Eliminar "${row.original.name}"? Esta acción no se puede deshacer.`}
          />
        ),
      },
    ],
    [editor, remove],
  );

  return (
    <>
      <PageHeader
        title="Categorías"
        description="Agrupa tus productos para filtrarlos y analizarlos."
        actions={
          <Button onClick={editor.openNew}>
            <Plus /> Nueva categoría
          </Button>
        }
      />
      <SearchInput
        className="mb-4"
        value={q}
        onChange={(value) => navigate({ search: { q: value || undefined, page: undefined } })}
        placeholder="Buscar categoría…"
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
      <CategoryDialog
        key={editor.item?.id ?? 'new'}
        open={editor.isOpen}
        item={editor.item}
        onClose={editor.close}
      />
    </>
  );
}

type FormIn = z.input<typeof upsertCategorySchema>;
type FormOut = z.output<typeof upsertCategorySchema>;

function CategoryDialog({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: Category | null;
  onClose: () => void;
}) {
  const create = categoriesApi.useCreate();
  const update = categoriesApi.useUpdate();
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(upsertCategorySchema),
    defaultValues: { name: item?.name ?? '', color: item?.color ?? SWATCHES[1] },
  });
  const color = form.watch('color');

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          <DialogDescription>El color ayuda a identificarla en listas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label="Nombre" htmlFor="cat-name" error={form.formState.errors.name?.message}>
            <Input autoFocus {...form.register('name')} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Color</legend>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => form.setValue('color', c, { shouldDirty: true })}
                  className="size-7 rounded-full ring-offset-2 ring-offset-popover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-foreground"
                  style={{ background: c }}
                  aria-pressed={color === c}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </fieldset>
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
