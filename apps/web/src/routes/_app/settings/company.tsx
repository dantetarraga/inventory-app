import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { updateCompanySchema, type Company } from '@stockpro/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page';
import { companyApi } from '@/features/api';
import { COUNTRIES, CURRENCIES } from '@/lib/currencies';
import { formatDate, formatNumber } from '@/lib/format';
import { requireModule } from '@/lib/guards';
import { applyServerErrors } from '@/lib/query';

export const Route = createFileRoute('/_app/settings/company')({
  beforeLoad: requireModule('company'),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(companyApi.options()),
      context.queryClient.ensureQueryData(companyApi.statsOptions()),
    ]),
  component: CompanyPage,
});

function CompanyPage() {
  const { data: company } = useSuspenseQuery(companyApi.options());
  const { data: stats } = useSuspenseQuery(companyApi.statsOptions());

  const statItems = [
    ['Usuarios', stats.users],
    ['Productos', stats.products],
    ['Categorías', stats.categories],
    ['Marcas', stats.brands],
    ['Almacenes', stats.warehouses],
  ] as const;

  return (
    <>
      <PageHeader
        title="Tu empresa"
        description={`Cliente desde ${formatDate(company.createdAt)}`}
      />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <CompanyForm company={company} />
        <Card>
          <CardHeader title="Resumen" />
          <CardContent>
            <dl className="grid gap-3">
              {statItems.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
                >
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="font-semibold">{formatNumber(value, 0)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

type FormIn = z.input<typeof updateCompanySchema>;
type FormOut = z.output<typeof updateCompanySchema>;

function CompanyForm({ company }: { company: Company }) {
  const update = companyApi.useUpdate();
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(updateCompanySchema),
    defaultValues: {
      name: company.name,
      taxId: company.taxId ?? '',
      currency: company.currency,
      country: company.country,
      address: company.address ?? '',
    },
  });
  const { errors, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        ...values,
        taxId: values.taxId || null,
        address: values.address || null,
      });
      form.reset(values);
    } catch (err) {
      applyServerErrors(err, form.setError);
    }
  });

  return (
    <Card>
      <CardHeader
        title="Datos generales"
        description="La moneda se usa en precios y reportes valorizados."
      />
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field
            label="Razón social"
            htmlFor="c-name"
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            <Input {...form.register('name')} />
          </Field>
          <Field label="RUC / NIT" htmlFor="c-tax" error={errors.taxId?.message}>
            <Input {...form.register('taxId')} />
          </Field>
          <Field label="País" htmlFor="c-country" error={errors.country?.message}>
            <Select {...form.register('country')}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Moneda" htmlFor="c-currency" error={errors.currency?.message}>
            <Select {...form.register('currency')}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dirección" htmlFor="c-address" error={errors.address?.message}>
            <Input {...form.register('address')} />
          </Field>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={!isDirty} loading={update.isPending}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
