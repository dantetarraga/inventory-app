import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AtSign, Building2, Coins, LockKeyhole, UserRound } from 'lucide-react';
import type { z } from 'zod';
import { registerSchema } from '@stockpro/shared';
import { FloatingField, FormAlert } from '@/components/auth/floating-field';
import { authTransition } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { authApi } from '@/features/api';
import { CURRENCIES } from '@/lib/currencies';
import { applyServerErrors, errorMessage } from '@/lib/query';
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
      await navigate({ to: '/', viewTransition: true });
    },
    onError: (err) => {
      if (!applyServerErrors(err, form.setError)) setFormError(errorMessage(err));
    },
  });

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((v) => register.mutate(v))} noValidate>
      <div>
        <h2 className="text-xl font-bold">Registra tu empresa</h2>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          Serás su administrador y podrás invitar a tu equipo.
        </p>
      </div>
      <FormAlert message={formError} />
      <div className="grid gap-4 sm:grid-cols-[1fr_9.5rem]">
        <FloatingField
          id="companyName"
          label="Nombre de la empresa"
          icon={Building2}
          autoComplete="organization"
          autoFocus
          error={errors.companyName?.message}
          {...form.register('companyName')}
        />
        <FloatingField id="currency" label="Moneda" icon={Coins} error={errors.currency?.message}>
          <select
            id="currency"
            className="peer h-14 w-full appearance-none border-0 border-b-2 border-[#d6d6d6] bg-transparent pb-1.5 pl-7 pt-5 text-[15px] font-medium text-[#202020] outline-none focus:border-transparent"
            {...form.register('currency', {
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                const c = CURRENCIES.find((x) => x.code === e.target.value);
                if (c) form.setValue('country', c.country);
              },
            })}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code} title={c.name}>
                {c.code}
              </option>
            ))}
          </select>
        </FloatingField>
      </div>
      <FloatingField
        id="fullName"
        label="Tu nombre"
        icon={UserRound}
        autoComplete="name"
        error={errors.fullName?.message}
        {...form.register('fullName')}
      />
      <FloatingField
        id="email"
        label="Email"
        icon={AtSign}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...form.register('email')}
      />
      <FloatingField
        id="password"
        label="Contraseña"
        icon={LockKeyhole}
        type="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres, con letras y números."
        error={errors.password?.message}
        {...form.register('password')}
      />
      <Button type="submit" size="lg" className="mt-2 w-full" loading={register.isPending}>
        Crear cuenta
      </Button>
      <p className="text-center text-sm text-[#6b6b6b]">
        ¿Ya tienes cuenta?{' '}
        <Link
          to="/login"
          viewTransition={authTransition('/login')}
          className="font-semibold text-[#ec580e] hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
