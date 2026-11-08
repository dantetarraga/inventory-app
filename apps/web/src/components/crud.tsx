import { useState, type ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';

export const listSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1).optional(),
  q: z.string().catch('').optional(),
});
export type ListSearch = z.infer<typeof listSearchSchema>;
export const PAGE_SIZE = 15;

export function RowActions({
  onEdit,
  onDelete,
  deleteTitle,
  deleteDescription,
  deleting,
  canEdit = true,
}: {
  onEdit?: () => void;
  onDelete?: () => Promise<unknown>;
  deleteTitle: string;
  deleteDescription: ReactNode;
  deleting?: boolean;
  canEdit?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  if (!canEdit) return null;
  return (
    <div className="flex justify-end gap-1">
      {onEdit && <IconButton size="icon-sm" label="Editar" icon={<Pencil />} onClick={onEdit} />}
      {onDelete && (
        <>
          <IconButton
            variant="danger"
            size="icon-sm"
            label="Eliminar"
            icon={<Trash2 />}
            onClick={() => setConfirm(true)}
          />
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title={deleteTitle}
            description={deleteDescription}
            confirmLabel="Eliminar"
            destructive
            loading={deleting}
            onConfirm={() =>
              onDelete().then(
                () => setConfirm(false),
                () => setConfirm(false),
              )
            }
          />
        </>
      )}
    </div>
  );
}

export function useEditor<T>() {
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  return {
    editing,
    isOpen: editing !== null,
    openNew: () => setEditing('new'),
    openEdit: (item: T) => setEditing(item),
    close: () => setEditing(null),
    item: editing === 'new' || editing === null ? null : editing,
  };
}
