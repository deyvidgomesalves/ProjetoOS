import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { roleLabel } from '../lib/permissions';
import { ClipboardIcon, PlusIcon } from './Icons';

/** Cabeçalho fixo + conteúdo da página. O menu muda conforme o perfil logado. */
export function Layout() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <div className="page-background flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white shadow-md shadow-indigo-500/25">
              <ClipboardIcon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base leading-tight font-bold text-slate-900">OS &amp; E-mails</span>
              <span className="block text-xs text-slate-500">Cadastro e consulta de ordens de serviço</span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center justify-end gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              Início
            </NavLink>

            {/* O botão de cadastro aparece apenas para o administrador. */}
            {isAdmin ? (
              <Link
                to="/os/nova"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                <PlusIcon className="h-4 w-4" />
                Nova OS
              </Link>
            ) : null}

            {user ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                <span className="text-right leading-tight">
                  <span className="block text-xs font-semibold text-slate-800">{user.name}</span>
                  <span className="block text-[11px] text-slate-500">{roleLabel(user.role)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  title="Sair do sistema"
                >
                  Sair
                </button>
              </div>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pt-2 pb-8 text-center text-xs text-slate-400">
        Os dados ficam salvos no banco de dados do servidor — nada é guardado apenas no navegador.
      </footer>
    </div>
  );
}
