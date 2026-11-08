import { useState, type ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';

/** Search params shared by list screens: kept in the URL so lists are linkable and survive reloads. */
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
      {onEdit && (
        <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} aria-label="Editar">
          <Pencil />
        </Button>
      )}
      {onDelete && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirm(true)}
            aria-label="Eliminar"
          >
            <Trash2 />
          </Button>
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

/** Open/close state for a create/edit dialog. `null` = closed, `'new'` = create, object = edit. */
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
