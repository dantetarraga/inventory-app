import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AtSign, LockKeyhole } from 'lucide-react';
import { z } from 'zod';
import { loginSchema, type LoginInput } from '@stockpro/shared';
import { FloatingField, FormAlert } from '@/components/auth/floating-field';
import { authTransition } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { authApi } from '@/features/api';
import { safeRedirect } from '@/lib/guards';
import { applyServerErrors, errorMessage } from '@/lib/query';
import { useSession } from '@/stores/session';

export const Route = createFileRoute('/_auth/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const setSession = useSession((s) => s.setSession);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors } = form.formState;

  const login = useMutation({
    mutationFn: authApi.login,
    onMutate: () => setFormError(null),
    onSuccess: async (auth) => {
      setSession(auth);
      await navigate({ to: safeRedirect(search.redirect), viewTransition: true });
    },
    onError: (err) => {
      if (!applyServerErrors(err, form.setError)) setFormError(errorMessage(err));
    },
  });

  return (
    <form className="grid gap-5" onSubmit={form.handleSubmit((v) => login.mutate(v))} noValidate>
      <div>
        <h2 className="text-xl font-bold">¡Hola de nuevo!</h2>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          Ingresa con tu cuenta o la que te dio tu empleador.
        </p>
      </div>
      <FormAlert message={formError} />
      <FloatingField
        id="email"
        label="Email"
        icon={AtSign}
        type="email"
        autoComplete="username"
        autoFocus
        error={errors.email?.message}
        {...form.register('email')}
      />
      <FloatingField
        id="password"
        label="Contraseña"
        icon={LockKeyhole}
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...form.register('password')}
      />
      <Button type="submit" size="lg" className="mt-2 w-full" loading={login.isPending}>
        Ingresar
      </Button>
      <p className="text-center text-sm text-[#6b6b6b]">
        ¿Tu empresa aún no usa StockPRO?{' '}
        <Link
          to="/register"
          viewTransition={authTransition('/register')}
          className="font-semibold text-[#ec580e] hover:underline"
        >
          Crea una cuenta
        </Link>
      </p>
    </form>
  );
}
