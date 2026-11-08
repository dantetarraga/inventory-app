import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  Coins,
  Laptop,
  Monitor,
  Package,
  Smartphone,
} from 'lucide-react';
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
import type { DashboardSummary } from '@stockpro/shared';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@/components/ui/card';
import { dashboardApi } from '@/features/api';
import { formatMonth, formatNumber, useMoney } from '@/lib/format';
import { useCan, useSession } from '@/stores/session';

export const Route = createFileRoute('/_app/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardApi.summaryOptions()),
  component: Dashboard,
  pendingComponent: () => (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  ),
});

const axisTick = { fill: 'var(--muted-foreground)', fontSize: 12 };
const tooltipStyle = {
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--popover-foreground)',
    fontSize: 12,
  },
  cursor: { fill: 'var(--muted)', opacity: 0.6 },
};

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  to,
}: {
  label: string;
  value: string;
  icon: typeof Package;
  tone?: 'warning';
  to?: string;
}) {
  const content = (
    <Card className="h-full transition-colors hover:border-primary/40">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <span
          className={
            tone === 'warning'
              ? 'grid size-9 place-items-center rounded-lg bg-warning/20 text-amber-700 dark:text-warning'
              : 'grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground'
          }
        >
          <Icon className="size-5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
  return to ? (
    <Link
      to={to}
      className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  ) : (
    content
  );
}

function MonthlyChart({ data }: { data: DashboardSummary['monthly'] }) {
  const rows = data.map((d) => ({
    month: formatMonth(d.month),
    Entradas: Number(d.in),
    Salidas: Number(d.out),
  }));
  const empty = rows.every((r) => r.Entradas === 0 && r.Salidas === 0);
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Entradas y salidas</CardTitle>
        <CardDescription>Unidades movidas en los últimos 6 meses</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <EmptyChart text="Aún no hay movimientos registrados." />
        ) : (
          <div
            className="h-72"
            role="img"
            aria-label="Gráfico de barras de entradas y salidas por mes"
          >
            <ResponsiveContainer>
              <BarChart data={rows} barGap={2} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} />
                <Tooltip {...tooltipStyle} formatter={(v) => formatNumber(Number(v))} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
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

function RankChart({
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyChart text={emptyText} />
        ) : (
          // Ranked list as HTML bars: direct labels, readable by screen readers, no chart lib needed.
          <ol className="grid gap-3" aria-label={title}>
            {rows.map((r) => {
              const max = Math.max(...rows.map((x) => x.value)) || 1;
              return (
                <li
                  key={r.name}
                  className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm"
                >
                  <span className="truncate text-muted-foreground" title={r.name}>
                    {r.name}
                  </span>
                  <span className="h-2.5 rounded-full bg-muted" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-[var(--series-1)]"
                      style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-14 text-right font-medium tabular-nums">
                    {formatNumber(r.value)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** "BannerHome" from the original: welcome text over a grid with a purple glow on hover. */
function WelcomeBanner({ name, company }: { name: string; company: string }) {
  return (
    <section className="group relative mb-4 overflow-hidden rounded-[10px] border border-transparent bg-card px-6 py-8 transition-all duration-500 hover:border-[#4d4d4d] md:px-10">
      <div
        className="bg-grid absolute inset-0 transition-transform duration-700 [mask-image:radial-gradient(circle,black_35%,transparent_75%)] group-hover:rotate-[8deg] group-hover:scale-125"
        aria-hidden
      />
      <div
        aria-hidden
        className="absolute -bottom-40 left-1/2 h-64 w-[60%] -translate-x-1/2 rounded-full bg-[#c300e2] opacity-0 blur-[90px] transition-all duration-700 group-hover:-bottom-24 group-hover:opacity-60"
      />
      <div className="relative flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="size-4" aria-hidden /> {company}
        </p>
        <h1 className="text-[30px] font-bold leading-tight">Hola, {name}</h1>
        <p className="max-w-xl text-sm leading-[1.7em] text-muted-foreground">
          Bienvenido a StockPRO: controla tus inventarios desde cualquier dispositivo.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Dispositivos compatibles">
          {[
            { label: 'PC', icon: Monitor },
            { label: 'Celular', icon: Smartphone },
            { label: 'Laptop', icon: Laptop },
          ].map(({ label, icon: Icon }) => (
            <li
              key={label}
              className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium transition-transform hover:-translate-y-1"
            >
              <Icon className="size-4 text-primary" aria-hidden /> {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <p className="grid h-40 place-items-center text-sm text-muted-foreground">{text}</p>;
}

function Dashboard() {
  const { data } = useQuery(dashboardApi.summaryOptions());
  const money = useMoney();
  const name = useSession((s) => s.me?.user.fullName.split(' ')[0]);
  const company = useSession((s) => s.me?.company.name);
  const canKardex = useCan('kardex');
  const canReports = useCan('reports');
  if (!data) return null;
  const { totals } = data;

  return (
    <>
      <WelcomeBanner name={name ?? ''} company={company ?? ''} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Productos" value={formatNumber(totals.products, 0)} icon={Package} />
        <StatTile
          label="Bajo stock mínimo"
          value={formatNumber(totals.lowStock, 0)}
          icon={AlertTriangle}
          tone={totals.lowStock > 0 ? 'warning' : undefined}
          to={canReports ? '/reports' : undefined}
        />
        <StatTile label="Inventario valorado" value={money(totals.inventoryValue)} icon={Coins} />
        <StatTile
          label="Movimientos este mes"
          value={formatNumber(totals.movementsThisMonth, 0)}
          icon={ArrowLeftRight}
          to={canKardex ? '/kardex' : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <MonthlyChart data={data.monthly} />
        <RankChart
          title="Stock por categoría"
          description="Unidades disponibles"
          rows={data.byCategory.map((c) => ({ name: c.category, value: Number(c.stock) }))}
          emptyText="Sin stock registrado."
        />
        <RankChart
          title="Más vendidos"
          description="Salidas de los últimos 30 días"
          rows={data.topProducts.map((p) => ({ name: p.name, value: Number(p.out) }))}
          emptyText="Sin salidas en los últimos 30 días."
        />
      </div>
    </>
  );
}
