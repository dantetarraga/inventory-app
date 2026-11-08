import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AtSign, LockKeyhole } from 'lucide-react';
import { z } from 'zod';
import { loginSchema, type LoginInput } from '@stockpro/shared';
import { AuthField, FormAlert } from '@/components/auth/auth-field';
import { authTransition } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { authApi } from '@/features/api';
import { safeRedirect } from '@/lib/guards';
import { ApiError } from '@/lib/http';
import { applyServerErrors, errorMessage } from '@/lib/query';
import { toast } from '@/plugins/toast.plugin';
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
      toast.success(`¡Hola, ${auth.me.user.fullName.split(' ')[0]}!`);
      await navigate({ to: safeRedirect(search.redirect), viewTransition: true });
    },
    onError: (err) => {
      if (applyServerErrors(err, form.setError)) return;
      setFormError(errorMessage(err));
      if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
        form.resetField('password');
        form.setFocus('password');
      }
    },
  });

  return (
    <form className="grid gap-6" onSubmit={form.handleSubmit((v) => login.mutate(v))} noValidate>
      <header className="grid gap-2">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight">Inicia sesión</h1>
        <p className="text-[15px] text-[#6b6b6b]">Usa tu cuenta o la que te dio tu empleador.</p>
      </header>

      <AuthField
        id="email"
        label="Email"
        icon={AtSign}
        type="email"
        autoComplete="username"
        placeholder="tu@empresa.com"
        autoFocus
        error={errors.email?.message}
        {...form.register('email')}
      />
      <AuthField
        id="password"
        label="Contraseña"
        icon={LockKeyhole}
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...form.register('password')}
      />

      <div className="grid gap-3">
        <FormAlert message={formError} />
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Ingresar
        </Button>
      </div>

      <p className="text-[15px] text-[#6b6b6b]">
        ¿Tu empresa aún no tiene cuenta?{' '}
        <Link
          to="/register"
          viewTransition={authTransition('/register')}
          className="whitespace-nowrap font-semibold text-[#1e1e1e] underline decoration-primary decoration-2 underline-offset-4 hover:text-[#ec580e]"
        >
          Registrar empresa
        </Link>
      </p>
    </form>
  );
}
