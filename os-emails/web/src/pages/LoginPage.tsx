import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ClipboardIcon, InfoIcon } from '../components/Icons';
import { Button, Callout, Field, Input } from '../components/ui';
import { useAuth } from '../lib/auth';

interface LoginState {
  from?: string;
}

/** Tela de acesso (dois perfis: administrador e somente consulta). */
export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LoginState | null)?.from ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to={from} replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError('Informe usuário e senha.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-lg shadow-indigo-500/25">
            <ClipboardIcon className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">OS &amp; E-mails</h1>
          <p className="mt-1 text-sm text-slate-500">Entre com seu usuário para acessar o sistema.</p>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5"
          noValidate
        >
          <div className="flex flex-col gap-4">
            <Field label="Usuário" htmlFor="login-usuario" required>
              <Input
                id="login-usuario"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setError(null);
                }}
                placeholder="seu usuário"
                autoComplete="username"
                autoFocus
              />
            </Field>

            <Field label="Senha" htmlFor="login-senha" required>
              <Input
                id="login-senha"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                }}
                placeholder="sua senha"
                autoComplete="current-password"
              />
            </Field>
          </div>

          {error ? (
            <div className="mt-4">
              <Callout title={error} />
            </div>
          ) : null}

          <Button type="submit" size="lg" loading={submitting} className="mt-5 w-full">
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>

          <div className="mt-5 flex gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <InfoIcon className="mt-0.5 h-4 w-4 flex-none text-slate-400" />
            <p>
              O perfil <strong>administrador</strong> cadastra, edita e exclui OS e e-mails. O perfil de{' '}
              <strong>consulta</strong> apenas pesquisa, abre as OS e copia os e-mails.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
