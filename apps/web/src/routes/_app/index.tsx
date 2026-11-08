import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, CircleCheck } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardSummary, Product } from '@stockpro/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, Skeleton } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { dashboardApi, productsApi } from '@/features/api';
import { formatMonth, formatNumber, useMoney } from '@/lib/format';
import { dates } from '@/plugins/date.plugin';
import { useCan, useSession } from '@/stores/session';

export const Route = createFileRoute('/_app/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardApi.summaryOptions()),
  component: Dashboard,
  pendingComponent: DashboardSkeleton,
});

const chartFont = { fill: 'var(--muted-foreground)', fontSize: 12, fontFamily: 'IBM Plex Sans' };
const tooltipProps = {
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--popover-foreground)',
    fontSize: 13,
    fontFamily: 'IBM Plex Sans',
  },
  cursor: { fill: 'var(--muted)', opacity: 0.5 },
};

function Dashboard() {
  const { data } = useQuery(dashboardApi.summaryOptions());
  const money = useMoney();
  const me = useSession((s) => s.me);
  const canKardex = useCan('kardex');
  const canReports = useCan('reports');
  if (!data || !me) return null;
  const { totals } = data;
  const day = dates.format(dates.now(), 'dayLong');
  const today = day.charAt(0).toUpperCase() + day.slice(1);

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-[28px] font-semibold leading-tight">
            Hola, {me.user.fullName.split(' ')[0]}
          </h1>
          <p className="text-[15px] text-muted-foreground">
            {today}. Este es el estado de tu inventario.
          </p>
        </div>
        {canKardex && (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/kardex" search={{ new: 'out' }}>
                <ArrowUpFromLine /> Registrar salida
              </Link>
            </Button>
            <Button asChild>
              <Link to="/kardex" search={{ new: 'in' }}>
                <ArrowDownToLine /> Registrar entrada
              </Link>
            </Button>
          </div>
        )}
      </header>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          emphasis
          className="xl:col-span-2"
          label="Valor del inventario"
          value={money(totals.inventoryValue)}
          hint="A precio de compra"
          to={canReports ? '/reports' : undefined}
          search={{ tab: 'valuation' }}
        />
        <StatCard
          label="Productos"
          value={formatNumber(totals.products, 0)}
          hint="Activos en el catálogo"
        />
        <StatCard
          label="Bajo stock mínimo"
          value={formatNumber(totals.lowStock, 0)}
          tone={totals.lowStock > 0 ? 'warning' : 'default'}
          hint={totals.lowStock > 0 ? 'Necesitan reposición' : 'Todo en orden'}
          to={canReports ? '/reports' : undefined}
          search={{ tab: 'low-stock' }}
        />
        <StatCard
          label="Movimientos del mes"
          value={formatNumber(totals.movementsThisMonth, 0)}
          hint="Entradas, salidas y ajustes"
          to={canKardex ? '/kardex' : undefined}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <MonthlyChart data={data.monthly} className="lg:col-span-2" />
        <RestockList enabled={totals.lowStock > 0} canKardex={canKardex} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <RankCard
          title="Stock por categoría"
          description="Unidades disponibles"
          rows={data.byCategory.map((c) => ({ name: c.category, value: Number(c.stock) }))}
          emptyText="Aún no hay stock registrado."
        />
        <RankCard
          title="Más vendidos"
          description="Salidas de los últimos 30 días"
          rows={data.topProducts.map((p) => ({ name: p.name, value: Number(p.out) }))}
          emptyText="Sin salidas en los últimos 30 días."
        />
      </section>
    </div>
  );
}

function MonthlyChart({
  data,
  className,
}: {
  data: DashboardSummary['monthly'];
  className?: string;
}) {
  const rows = data.map((d) => ({
    month: formatMonth(d.month),
    Entradas: Number(d.in),
    Salidas: Number(d.out),
  }));
  const empty = rows.every((r) => r.Entradas === 0 && r.Salidas === 0);
  return (
    <Card className={className}>
      <CardHeader
        title="Entradas y salidas"
        description="Unidades movidas en los últimos 6 meses"
      />
      <CardContent>
        {empty ? (
          <EmptyState text="Cuando registres movimientos, aquí verás cómo entra y sale tu stock." />
        ) : (
          <div className="h-72" role="img" aria-label="Entradas y salidas por mes">
            <ResponsiveContainer>
              <BarChart data={rows} barGap={2} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="month" tick={chartFont} tickLine={false} axisLine={false} />
                <YAxis tick={chartFont} tickLine={false} axisLine={false} width={48} />
                <Tooltip {...tooltipProps} formatter={(v) => formatNumber(Number(v))} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 13, fontFamily: 'IBM Plex Sans' }}
                />
                <Bar
                  dataKey="Entradas"
                  fill="var(--series-1)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="Salidas"
                  fill="var(--series-2)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RestockList({ enabled, canKardex }: { enabled: boolean; canKardex: boolean }) {
  const { data } = useQuery({
    ...productsApi.listOptions({ lowStock: true, page: 1, pageSize: 6 }),
    enabled,
  });
  const items = data?.items ?? [];

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Por reponer"
        description="Productos en o por debajo de su stock mínimo"
        actions={
          enabled && (
            <Link
              to="/settings/products"
              search={{ lowStock: true }}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Ver todos
            </Link>
          )
        }
      />
      <CardContent className="flex-1">
        {!enabled ? (
          <div className="grid h-full min-h-40 place-items-center text-center">
            <div>
              <CircleCheck className="mx-auto size-8 text-success" aria-hidden />
              <p className="mt-2 text-[14px] font-medium">Todo el stock está sobre el mínimo</p>
            </div>
          </div>
        ) : (
          <ul className="grid gap-1">
            {items.map((p) => (
              <RestockRow key={p.id} product={p} canKardex={canKardex} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RestockRow({ product, canKardex }: { product: Product; canKardex: boolean }) {
  const stock = Number(product.stock);
  const min = Number(product.minStock) || 1;
  const ratio = Math.min(1, stock / min);
  const content = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[14px] font-medium">{product.name}</span>
        <span className="tabular shrink-0 text-[13px] text-muted-foreground">
          <span className="font-semibold text-amber-600 dark:text-warning">
            {formatNumber(product.stock)}
          </span>{' '}
          / {formatNumber(product.minStock)}
        </span>
      </div>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className="block h-full rounded-full bg-warning"
          style={{ width: `${Math.max(4, ratio * 100)}%` }}
        />
      </span>
    </>
  );
  return (
    <li>
      {canKardex ? (
        <Link
          to="/kardex"
          search={{ new: 'in', productId: product.id }}
          className="block rounded-md px-2 py-2.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={`Registrar entrada de ${product.name}`}
        >
          {content}
        </Link>
      ) : (
        <div className="px-2 py-2.5">{content}</div>
      )}
    </li>
  );
}

function RankCard({
  title,
  description,
  rows,
  emptyText,
}: {
  title: string;
  description: string;
  rows: Array<{ name: string; value: number }>;
  emptyText: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState text={emptyText} />
        ) : (
          <ol className="grid gap-3.5" aria-label={title}>
            {rows.map((r) => (
              <li
                key={r.name}
                className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-[14px]"
              >
                <span className="truncate" title={r.name}>
                  {r.name}
                </span>
                <span className="h-2 rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-[var(--series-1)]"
                    style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
                  />
                </span>
                <span className="tabular w-14 text-right font-medium">{formatNumber(r.value)}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="grid min-h-40 place-items-center px-6 text-center text-[14px] text-muted-foreground">
      {text}
    </p>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-5 pt-2">
      <Skeleton className="h-16 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Skeleton className="h-32 xl:col-span-2" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
