import * as React from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from './button';
import { Skeleton } from './card';

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  getRowId?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyMessage = 'No hay registros',
  page,
  pageSize,
  total,
  onPageChange,
  getRowId,
}: DataTableProps<T>) {
  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    getRowId,
  });

  const pageCount = total !== undefined && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  return (
    <div className="overflow-hidden rounded-[10px] bg-card">
      <div className="overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b-2 border-[rgba(115,115,115,0.32)]">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className={cn(
                      'h-10 px-4 text-left align-middle text-sm font-medium text-foreground',
                      (header.column.columnDef.meta as { className?: string } | undefined)
                        ?.className,
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading && !data ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b last:border-0">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  <Inbox className="mx-auto mb-2 size-8 opacity-50" aria-hidden />
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[rgba(161,161,161,0.32)] transition-colors last:border-0 even:bg-black/[0.025] dark:even:bg-white/[0.03] hover:bg-primary/10"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-2.5 align-middle',
                        (cell.column.columnDef.meta as { className?: string } | undefined)
                          ?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {onPageChange && page !== undefined && total !== undefined && total > 0 && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2 text-sm text-muted-foreground">
          <span>
            {total} registro{total === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <span>
              Página {page} de {pageCount}
            </span>
            <IconButton
              size="icon-sm"
              className="border"
              label="Página anterior"
              icon={<ChevronLeft />}
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            />
            <IconButton
              size="icon-sm"
              className="border"
              label="Página siguiente"
              icon={<ChevronRight />}
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
