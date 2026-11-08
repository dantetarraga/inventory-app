import * as React from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from './button';
import { Skeleton } from './card';

const actionsCellClass =
  'transition-opacity duration-150 [@media(hover:hover)]:opacity-45 group-hover/row:opacity-100 group-focus-within/row:opacity-100';

type ColumnMeta = { className?: string };

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  loading?: boolean;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
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
  emptyAction,
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
  const from = page && pageSize ? (page - 1) * pageSize + 1 : 1;
  const to = page && pageSize && total !== undefined ? Math.min(page * pageSize, total) : total;
  const metaClass = (meta: unknown) => (meta as ColumnMeta | undefined)?.className;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead className="bg-muted/45 dark:bg-white/[0.025]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className={cn(
                      'h-10 whitespace-nowrap px-4 text-left align-middle text-[12.5px] font-medium text-muted-foreground',
                      metaClass(header.column.columnDef.meta),
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
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="border-b last:border-0">
                  {columns.map((_, j) => (
                    <td key={j} className="h-[52px] px-4">
                      <Skeleton className={cn('h-3.5', j === 0 ? 'w-40' : 'w-16')} />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-14">
                  <div className="mx-auto grid max-w-sm justify-items-center gap-3 text-center">
                    <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                      <PackageOpen className="size-6" aria-hidden />
                    </span>
                    <p className="text-[14px] text-muted-foreground">{emptyMessage}</p>
                    {emptyAction}
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="group/row border-b transition-colors last:border-0 hover:bg-row-hover"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'h-[52px] px-4 py-2 align-middle',
                        cell.column.id === 'actions' && actionsCellClass,
                        metaClass(cell.column.columnDef.meta),
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
        <div className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-[13px] text-muted-foreground">
          <span className="tabular">
            {from}–{to} de {total}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="tabular mr-1">
              Página {page} de {pageCount}
            </span>
            <IconButton
              variant="outline"
              size="icon-sm"
              label="Página anterior"
              icon={<ChevronLeft />}
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            />
            <IconButton
              variant="outline"
              size="icon-sm"
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
