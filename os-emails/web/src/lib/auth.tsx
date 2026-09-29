import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { api } from './api';
import { canManage } from './permissions';
import type { SessionUser } from '../types';

interface AuthContextValue {
  user: SessionUser | null;
  /** true enquanto a sessão está sendo verificada ao abrir a página. */
  loading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Descobre quem está logado ao abrir a aplicação (o cookie de sessão é enviado junto).
  useEffect(() => {
    let active = true;

    api
      .me()
      .then((response) => {
        if (active) setUser(response.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // A API avisa quando a sessão caiu (expirou) — volta para a tela de login.
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('os-emails:unauthorized', handler);
    return () => window.removeEventListener('os-emails:unauthorized', handler);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.login(username, password);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isAdmin: canManage(user), login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa ser usado dentro de <AuthProvider>.');
  return context;
}

/** Exige login: sem sessão, mostra a tela de login. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Exige o perfil administrador (cadastrar/editar). */
export function RequireAdmin() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <Navigate to="/" replace state={{ flash: 'Somente o administrador pode cadastrar ou editar OS.' }} />
    );
  }

  return <Outlet />;
}

function FullScreenLoading() {
  return (
    <div className="page-background flex min-h-screen items-center justify-center">
      <p className="animate-pulse text-sm font-medium text-slate-500">Carregando o sistema...</p>
    </div>
  );
}
