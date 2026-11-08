import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AtSign, Building2, Coins, LockKeyhole, UserRound } from 'lucide-react';
import type { z } from 'zod';
import { registerSchema } from '@stockpro/shared';
import { AuthField, authControlClass, FormAlert } from '@/components/auth/auth-field';
import { authTransition } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { authApi } from '@/features/api';
import { CURRENCIES } from '@/lib/currencies';
import { applyServerErrors, errorMessage } from '@/lib/query';
import { toast } from '@/plugins/toast.plugin';
import { useSession } from '@/stores/session';

export const Route = createFileRoute('/_auth/register')({ component: RegisterPage });

type FormIn = z.input<typeof registerSchema>;
type FormOut = z.output<typeof registerSchema>;

function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useSession((s) => s.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      companyName: '',
      currency: 'PEN',
      country: 'PE',
    },
  });
  const { errors } = form.formState;

  const register = useMutation({
    mutationFn: authApi.register,
    onMutate: () => setFormError(null),
    onSuccess: async (auth) => {
      setSession(auth);
      toast.success('Empresa registrada', {
        description: `${auth.me.company.name} ya está lista. Empieza registrando tus productos.`,
      });
      await navigate({ to: '/', viewTransition: true });
    },
    onError: (err) => {
      if (!applyServerErrors(err, form.setError)) setFormError(errorMessage(err));
    },
  });

  return (
    <form className="grid gap-5" onSubmit={form.handleSubmit((v) => register.mutate(v))} noValidate>
      <header className="grid gap-2">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight">Registra tu empresa</h1>
        <p className="text-[15px] text-[#6b6b6b]">Serás el administrador de la cuenta.</p>
      </header>

      <AuthField
        id="companyName"
        label="Nombre de la empresa"
        icon={Building2}
        autoComplete="organization"
        autoFocus
        error={errors.companyName?.message}
        {...form.register('companyName')}
      />
      <AuthField id="currency" label="Moneda" icon={Coins} error={errors.currency?.message}>
        <select
          id="currency"
          className={authControlClass}
          {...form.register('currency', {
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
              const c = CURRENCIES.find((x) => x.code === e.target.value);
              if (c) form.setValue('country', c.country);
            },
          })}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
      </AuthField>
      <AuthField
        id="fullName"
        label="Tu nombre"
        icon={UserRound}
        autoComplete="name"
        error={errors.fullName?.message}
        {...form.register('fullName')}
      />
      <AuthField
        id="email"
        label="Email"
        icon={AtSign}
        type="email"
        autoComplete="email"
        placeholder="tu@empresa.com"
        error={errors.email?.message}
        {...form.register('email')}
      />
      <AuthField
        id="password"
        label="Contraseña"
        icon={LockKeyhole}
        type="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres, con letras y números."
        error={errors.password?.message}
        {...form.register('password')}
      />

      <div className="grid gap-3">
        <FormAlert message={formError} />
        <Button type="submit" size="lg" className="mt-1 w-full" loading={register.isPending}>
          Registrar empresa
        </Button>
      </div>

      <p className="text-[15px] text-[#6b6b6b]">
        ¿Ya tienes cuenta?{' '}
        <Link
          to="/login"
          viewTransition={authTransition('/login')}
          className="whitespace-nowrap font-semibold text-[#1e1e1e] underline decoration-primary decoration-2 underline-offset-4 hover:text-[#ec580e]"
        >
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
