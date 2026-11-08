import { useMemo, useState, type ReactNode } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  MOVEMENT_TYPE_LABELS,
  type KardexReportRow,
  type Product,
  type StockReportRow,
} from '@stockpro/shared';
import { ProductPicker } from '@/components/product-picker';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Input, Label } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page';
import { reportsApi } from '@/features/api';
import type { PdfColumn, PdfReport } from '@/features/reports/pdf';
import { formatDateTime, formatNumber, useMoney } from '@/lib/format';
import { requireModule } from '@/lib/guards';
import { download } from '@/lib/http';
import { errorMessage } from '@/lib/query';
import { cn } from '@/lib/utils';
import { useSession } from '@/stores/session';

const TABS = [
  { id: 'stock', label: 'Stock actual' },
  { id: 'low-stock', label: 'Bajo mínimo' },
  { id: 'product', label: 'Por producto' },
  { id: 'kardex', label: 'Entradas y salidas' },
  { id: 'valuation', label: 'Inventario valorado' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export const Route = createFileRoute('/_app/reports')({
  beforeLoad: requireModule('reports'),
  validateSearch: z.object({
    tab: z
      .enum(TABS.map((t) => t.id) as [TabId, ...TabId[]])
      .catch('stock')
      .optional(),
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { tab = 'stock' } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <>
      <PageHeader title="Reportes" description="Consulta y exporta a PDF o Excel." />
      <div
        role="tablist"
        aria-label="Reportes"
        className="mb-4 flex gap-1 overflow-x-auto border-b"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => navigate({ search: { tab: t.id } })}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'stock' && <StockReport low={false} />}
        {tab === 'low-stock' && <StockReport low />}
        {tab === 'product' && <ProductReport />}
        {tab === 'kardex' && <KardexReport />}
        {tab === 'valuation' && <ValuationReport />}
      </div>
    </>
  );
}

function ExportBar({
  children,
  onPdf,
  xlsx,
  disabled,
}: {
  children?: ReactNode;
  onPdf: () => Promise<void>;
  xlsx?: { path: string; query?: Record<string, string | number | undefined>; name: string };
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const run = async (kind: 'pdf' | 'xlsx', fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={disabled}
          loading={busy === 'pdf'}
          onClick={() => run('pdf', onPdf)}
        >
          <FileDown /> PDF
        </Button>
        {xlsx && (
          <Button
            variant="outline"
            disabled={disabled}
            loading={busy === 'xlsx'}
            onClick={() =>
              run('xlsx', () =>
                download(xlsx.path, { ...xlsx.query, format: 'xlsx' }, `${xlsx.name}.xlsx`),
              )
            }
          >
            <FileSpreadsheet /> Excel
          </Button>
        )}
      </div>
    </div>
  );
}

function usePdf() {
  const company = useSession((s) => s.me?.company.name ?? '');
  return async (report: Omit<PdfReport, 'company'>, filename: string) => {
    const { downloadPdf } = await import('@/features/reports/pdf');
    await downloadPdf({ ...report, company }, filename);
  };
}

const stockPdfColumns: PdfColumn[] = [
  { header: 'Producto', key: 'name', width: 3 },
  { header: 'Categoría', key: 'category', width: 1.5 },
  { header: 'Marca', key: 'brand', width: 1.5 },
  { header: 'Stock', key: 'stock', align: 'right' },
  { header: 'Mínimo', key: 'minStock', align: 'right' },
];
const stockRowsToPdf = (rows: StockReportRow[]) =>
  rows.map((r) => ({
    name: r.name,
    category: r.category ?? '—',
    brand: r.brand ?? '—',
    stock: formatNumber(r.stock),
    minStock: formatNumber(r.minStock),
  }));

function StockReport({ low }: { low: boolean }) {
  const { data, isLoading } = useQuery(low ? reportsApi.lowStock() : reportsApi.stock());
  const exportPdf = usePdf();
  const columns = useMemo<ColumnDef<StockReportRow, unknown>[]>(
    () => [
      {
        header: 'Producto',
        accessorKey: 'name',
        cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span>,
      },
      {
        header: 'Categoría',
        accessorKey: 'category',
        cell: ({ getValue }) => (getValue() as string | null) ?? '—',
      },
      {
        header: 'Marca',
        accessorKey: 'brand',
        cell: ({ getValue }) => (getValue() as string | null) ?? '—',
      },
      {
        header: 'Stock',
        accessorKey: 'stock',
        meta: { className: 'text-right' },
        cell: ({ row }) => {
          const isLow = Number(row.original.stock) <= Number(row.original.minStock);
          return (
            <span className="inline-flex items-center gap-1.5 font-medium">
              {isLow && <Badge variant="warning">Bajo</Badge>}
              {formatNumber(row.original.stock)}
            </span>
          );
        },
      },
      {
        header: 'Mínimo',
        accessorKey: 'minStock',
        meta: { className: 'text-right' },
        cell: ({ getValue }) => formatNumber(getValue() as string),
      },
    ],
    [],
  );
  const title = low ? 'Productos bajo stock mínimo' : 'Stock actual de todos los productos';
  return (
    <>
      <ExportBar
        disabled={!data}
        onPdf={() =>
          exportPdf(
            { title, columns: stockPdfColumns, rows: stockRowsToPdf(data ?? []) },
            low ? 'stock-bajo-minimo' : 'stock-actual',
          )
        }
        xlsx={{
          path: low ? '/reports/low-stock' : '/reports/stock',
          name: low ? 'stock-bajo-minimo' : 'stock-actual',
        }}
      >
        <p className="text-sm text-muted-foreground">{data ? `${data.length} productos` : ''}</p>
      </ExportBar>
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        getRowId={(r) => String(r.productId)}
        emptyMessage={low ? '¡Ningún producto está bajo el mínimo!' : 'No hay productos'}
      />
    </>
  );
}

function ProductReport() {
  const [product, setProduct] = useState<Product | null>(null);
  const { data } = useQuery({ ...reportsApi.productStock(product?.id ?? 0), enabled: !!product });
  const exportPdf = usePdf();
  return (
    <>
      <ExportBar
        disabled={!data}
        onPdf={() =>
          exportPdf(
            {
              title: `Stock de ${data!.product.name}`,
              subtitle: [data!.product.category, data!.product.brand].filter(Boolean).join(' · '),
              columns: [
                { header: 'Almacén', key: 'warehouse', width: 3 },
                { header: 'Stock', key: 'stock', align: 'right' },
              ],
              rows: data!.warehouses.map((w) => ({
                warehouse: w.warehouse,
                stock: formatNumber(w.stock),
              })),
              footer: [{ label: 'Total', value: formatNumber(data!.product.stock) }],
            },
            'stock-producto',
          )
        }
      >
        <div className="grid w-80 max-w-full gap-1.5">
          <Label htmlFor="rp-product">Producto</Label>
          <ProductPicker id="rp-product" value={product} onChange={setProduct} />
        </div>
      </ExportBar>
      {data ? (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{data.product.name}</h2>
              <p className="text-sm text-muted-foreground">
                Stock total{' '}
                <span className="text-2xl font-semibold text-foreground">
                  {formatNumber(data.product.stock)}
                </span>{' '}
                · mínimo {formatNumber(data.product.minStock)}
              </p>
            </div>
            <ul className="mt-4 divide-y">
              {data.warehouses.map((w) => (
                <li key={w.warehouseId} className="flex justify-between py-2 text-sm">
                  <span>{w.warehouse}</span>
                  <span className="font-medium">{formatNumber(w.stock)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Selecciona un producto para ver su stock por almacén.
        </p>
      )}
    </>
  );
}

function KardexReport() {
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [product, setProduct] = useState<Product | null>(null);
  const params = { ...range, productId: product?.id };
  const { data, isLoading } = useQuery(reportsApi.kardex(params));
  const exportPdf = usePdf();
  const columns = useMemo<ColumnDef<KardexReportRow, unknown>[]>(
    () => [
      {
        header: 'Fecha',
        accessorKey: 'occurredAt',
        meta: { className: 'whitespace-nowrap' },
        cell: ({ getValue }) => formatDateTime(getValue() as string),
      },
      {
        header: 'Producto',
        accessorKey: 'product',
        cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span>,
      },
      {
        header: 'Tipo',
        accessorKey: 'type',
        cell: ({ row }) => MOVEMENT_TYPE_LABELS[row.original.type],
      },
      {
        header: 'Cantidad',
        accessorKey: 'delta',
        meta: { className: 'text-right' },
        cell: ({ getValue }) => formatNumber(getValue() as string),
      },
      {
        header: 'Saldo',
        accessorKey: 'balanceAfter',
        meta: { className: 'text-right' },
        cell: ({ getValue }) => formatNumber(getValue() as string),
      },
      { header: 'Usuario', accessorKey: 'user' },
    ],
    [],
  );
  const subtitle = [
    range.from && `Desde ${range.from}`,
    range.to && `hasta ${range.to}`,
    product && `Producto: ${product.name}`,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <>
      <ExportBar
        disabled={!data}
        onPdf={() =>
          exportPdf(
            {
              title: 'Kardex de entradas y salidas',
              subtitle: subtitle || 'Todos los movimientos',
              landscape: true,
              columns: [
                { header: 'Fecha', key: 'date', width: 1.4 },
                { header: 'Producto', key: 'product', width: 3 },
                { header: 'Almacén', key: 'warehouse', width: 1.5 },
                { header: 'Tipo', key: 'type' },
                { header: 'Cantidad', key: 'delta', align: 'right' },
                { header: 'Saldo', key: 'balance', align: 'right' },
                { header: 'Usuario', key: 'user', width: 1.5 },
              ],
              rows: (data ?? []).map((r) => ({
                date: formatDateTime(r.occurredAt),
                product: r.product,
                warehouse: r.warehouse,
                type: MOVEMENT_TYPE_LABELS[r.type],
                delta: formatNumber(r.delta),
                balance: formatNumber(r.balanceAfter),
                user: r.user,
              })),
            },
            'kardex',
          )
        }
        xlsx={{ path: '/reports/kardex', query: params, name: 'kardex' }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="rk-from">Desde</Label>
          <Input
            variant="box"
            id="rk-from"
            type="date"
            className="w-40"
            value={range.from ?? ''}
            max={range.to}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || undefined }))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rk-to">Hasta</Label>
          <Input
            variant="box"
            id="rk-to"
            type="date"
            className="w-40"
            value={range.to ?? ''}
            min={range.from}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || undefined }))}
          />
        </div>
        <div className="grid w-72 max-w-full gap-1.5">
          <Label htmlFor="rk-product">Producto (opcional)</Label>
          <ProductPicker id="rk-product" value={product} onChange={setProduct} />
        </div>
      </ExportBar>
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        getRowId={(r) => String(r.id)}
        emptyMessage="Sin movimientos en el periodo"
      />
    </>
  );
}

function ValuationReport() {
  const { data, isLoading } = useQuery(reportsApi.valuation());
  const money = useMoney();
  const exportPdf = usePdf();
  type Row = NonNullable<typeof data>['rows'][number];
  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        header: 'Producto',
        accessorKey: 'name',
        cell: ({ getValue }) => <span className="font-medium">{String(getValue())}</span>,
      },
      {
        header: 'Stock',
        accessorKey: 'stock',
        meta: { className: 'text-right' },
        cell: ({ getValue }) => formatNumber(getValue() as string),
      },
      {
        header: 'Precio compra',
        accessorKey: 'purchasePrice',
        meta: { className: 'text-right' },
        cell: ({ getValue }) => money(getValue() as string),
      },
      {
        header: 'Total',
        accessorKey: 'total',
        meta: { className: 'text-right font-medium' },
        cell: ({ getValue }) => money(getValue() as string),
      },
    ],
    [money],
  );
  return (
    <>
      <ExportBar
        disabled={!data}
        onPdf={() =>
          exportPdf(
            {
              title: 'Inventario valorado',
              subtitle: 'Valorizado a precio de compra',
              columns: [
                { header: 'Producto', key: 'name', width: 3 },
                { header: 'Stock', key: 'stock', align: 'right' },
                { header: 'P. compra', key: 'price', align: 'right' },
                { header: 'Total', key: 'total', align: 'right' },
              ],
              rows: (data?.rows ?? []).map((r) => ({
                name: r.name,
                stock: formatNumber(r.stock),
                price: money(r.purchasePrice),
                total: money(r.total),
              })),
              footer: [{ label: 'Total general', value: money(data?.grandTotal ?? '0') }],
            },
            'inventario-valorado',
          )
        }
        xlsx={{ path: '/reports/valuation', name: 'inventario-valorado' }}
      >
        {data && (
          <div>
            <p className="text-sm text-muted-foreground">Total general</p>
            <p className="text-2xl font-semibold">{money(data.grandTotal)}</p>
          </div>
        )}
      </ExportBar>
      <DataTable
        columns={columns}
        data={data?.rows}
        loading={isLoading}
        getRowId={(r) => String(r.productId)}
      />
    </>
  );
}
