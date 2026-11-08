import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { z } from 'zod';
import {
  createUserSchema,
  DOC_TYPE_LABELS,
  DOC_TYPES,
  MODULE_NAMES,
  MODULES,
  ROLE_LABELS,
  updateUserSchema,
  type ModuleCode,
  type User,
} from '@stockpro/shared';
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
import { usersApi } from '@/features/api';
import { requireModule } from '@/lib/guards';
import { applyServerErrors } from '@/lib/query';
import { useSession } from '@/stores/session';

export const Route = createFileRoute('/_app/settings/users')({
  beforeLoad: requireModule('users'),
  validateSearch: listSearchSchema,
  component: UsersPage,
});

function UsersPage() {
  const { page = 1, q = '' } = Route.useSearch();
  const navigate = Route.useNavigate();
  const me = useSession((s) => s.me);
  const isAdmin = me?.user.role === 'admin';
  const { data, isLoading } = useQuery(usersApi.listOptions({ page, pageSize: PAGE_SIZE, q }));
  const remove = usersApi.useRemove();
  const editor = useEditor<User>();

  const columns = useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        header: 'Usuario',
        accessorKey: 'fullName',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row.original.fullName}
              {row.original.id === me?.user.id && (
                <span className="ml-1 text-xs text-muted-foreground">(tú)</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{row.original.email}</div>
          </div>
        ),
      },
      {
        header: 'Rol',
        accessorKey: 'role',
        cell: ({ row }) => (
          <Badge variant={row.original.role === 'admin' ? 'default' : 'secondary'}>
            {ROLE_LABELS[row.original.role]}
          </Badge>
        ),
      },
      {
        header: 'Permisos',
        id: 'permissions',
        cell: ({ row }) =>
          row.original.role === 'admin' ? (
            <span className="text-muted-foreground">Todos</span>
          ) : row.original.permissions.length === 0 ? (
            <span className="text-muted-foreground">Ninguno</span>
          ) : (
            <span className="line-clamp-2 max-w-72 text-xs">
              {row.original.permissions.map((p) => MODULE_NAMES[p]).join(', ')}
            </span>
          ),
      },
      {
        header: 'Estado',
        accessorKey: 'status',
        cell: ({ row }) =>
          row.original.status === 'active' ? (
            <Badge variant="success">Activo</Badge>
          ) : (
            <Badge variant="outline">Inactivo</Badge>
          ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        meta: { className: 'w-24' },
        cell: ({ row }) => (
          <RowActions
            // Only admins manage admins (enforced by the API too).
            canEdit={isAdmin || row.original.role !== 'admin'}
            onEdit={() => editor.openEdit(row.original)}
            onDelete={
              row.original.id === me?.user.id
                ? undefined
                : () => remove.mutateAsync(row.original.id)
            }
            deleting={remove.isPending}
            deleteTitle="Eliminar usuario"
            deleteDescription={`¿Eliminar a ${row.original.fullName}? Si tiene movimientos registrados, desactívalo en su lugar.`}
          />
        ),
      },
    ],
    [editor, remove, me, isAdmin],
  );

  return (
    <>
      <PageHeader
        title="Personal"
        description="Crea usuarios para tu equipo y define a qué módulos acceden."
        actions={
          <Button onClick={editor.openNew}>
            <Plus /> Nuevo usuario
          </Button>
        }
      />
      <SearchInput
        className="mb-4"
        value={q}
        onChange={(value) => navigate({ search: { q: value || undefined, page: undefined } })}
        placeholder="Buscar por nombre o email…"
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
      <UserDialog
        key={editor.item?.id ?? 'new'}
        open={editor.isOpen}
        item={editor.item}
        onClose={editor.close}
        canAssignAdmin={isAdmin}
        isSelf={editor.item?.id === me?.user.id}
      />
    </>
  );
}

const emptyToNull = z.string().transform((v) => v.trim() || null);
const formSchema = z.object({
  fullName: createUserSchema.shape.fullName,
  email: z.string(),
  password: z.string(),
  docType: z.string().transform((v) => (v ? (v as (typeof DOC_TYPES)[number]) : null)),
  docNumber: emptyToNull,
  phone: emptyToNull,
  address: emptyToNull,
  role: createUserSchema.shape.role,
  status: updateUserSchema.shape.status,
  permissions: z.array(z.string()),
});
type FormIn = z.input<typeof formSchema>;
type FormOut = z.output<typeof formSchema>;

function UserDialog({
  open,
  item,
  onClose,
  canAssignAdmin,
  isSelf,
}: {
  open: boolean;
  item: User | null;
  onClose: () => void;
  canAssignAdmin: boolean;
  isSelf: boolean;
}) {
  const create = usersApi.useCreate();
  const update = usersApi.useUpdate();
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: item?.fullName ?? '',
      email: item?.email ?? '',
      password: '',
      docType: item?.docType ?? '',
      docNumber: item?.docNumber ?? '',
      phone: item?.phone ?? '',
      address: item?.address ?? '',
      role: item?.role ?? 'employee',
      status: item?.status ?? 'active',
      permissions: item?.role === 'employee' ? item.permissions : ['kardex'],
    },
  });
  const { errors } = form.formState;
  const role = form.watch('role');

  const onSubmit = form.handleSubmit(
    async ({ email, password, permissions, status, ...values }) => {
      const perms = permissions as ModuleCode[];
      // Validate with the exact API schemas so client and server rules match.
      const parsed = item
        ? updateUserSchema.safeParse({
            ...values,
            status,
            permissions: perms,
            password: password || undefined,
          })
        : createUserSchema.safeParse({ ...values, email, password, permissions: perms });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          form.setError(issue.path.join('.') as keyof FormIn, { message: issue.message });
        }
        return;
      }
      try {
        if (item)
          await update.mutateAsync({
            id: item.id,
            body: parsed.data as z.input<typeof updateUserSchema>,
          });
        else await create.mutateAsync(parsed.data as z.input<typeof createUserSchema>);
        onClose();
      } catch (err) {
        applyServerErrors(err, form.setError);
      }
    },
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            {item
              ? 'Deja la contraseña vacía para mantener la actual.'
              : 'El usuario podrá ingresar con este email y contraseña.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field
            label="Nombre completo"
            htmlFor="u-name"
            error={errors.fullName?.message}
            className="sm:col-span-2"
          >
            <Input autoFocus {...form.register('fullName')} />
          </Field>
          <Field label="Email" htmlFor="u-email" error={errors.email?.message}>
            <Input type="email" autoComplete="off" disabled={!!item} {...form.register('email')} />
          </Field>
          <Field
            label={item ? 'Nueva contraseña' : 'Contraseña'}
            htmlFor="u-pass"
            error={errors.password?.message}
            hint="Mínimo 8 caracteres, con letras y números."
          >
            <Input type="password" autoComplete="new-password" {...form.register('password')} />
          </Field>
          <Field label="Tipo de documento" htmlFor="u-doctype" error={errors.docType?.message}>
            <Select {...form.register('docType')}>
              <option value="">—</option>
              {DOC_TYPES.map((d) => (
                <option key={d} value={d}>
                  {DOC_TYPE_LABELS[d]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nº de documento" htmlFor="u-docnum" error={errors.docNumber?.message}>
            <Input {...form.register('docNumber')} />
          </Field>
          <Field label="Teléfono" htmlFor="u-phone" error={errors.phone?.message}>
            <Input type="tel" {...form.register('phone')} />
          </Field>
          <Field label="Dirección" htmlFor="u-address" error={errors.address?.message}>
            <Input {...form.register('address')} />
          </Field>
          <Field label="Rol" htmlFor="u-role" error={errors.role?.message}>
            <Select {...form.register('role')} disabled={isSelf}>
              <option value="employee">{ROLE_LABELS.employee}</option>
              {(canAssignAdmin || item?.role === 'admin') && (
                <option value="admin">{ROLE_LABELS.admin}</option>
              )}
            </Select>
          </Field>
          {item && (
            <Field label="Estado" htmlFor="u-status" error={errors.status?.message}>
              <Select {...form.register('status')} disabled={isSelf}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </Select>
            </Field>
          )}
          <fieldset className="sm:col-span-2" disabled={role === 'admin'}>
            <legend className="mb-2 text-sm font-medium">Módulos permitidos</legend>
            {role === 'admin' ? (
              <p className="text-sm text-muted-foreground">
                Los administradores tienen acceso a todos los módulos.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {MODULES.map((m) => (
                  <label
                    key={m.code}
                    className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary/50 has-[:checked]:bg-accent"
                  >
                    <input
                      type="checkbox"
                      value={m.code}
                      className="size-4 accent-[var(--primary)]"
                      {...form.register('permissions')}
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
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
