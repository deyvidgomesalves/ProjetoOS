import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { AuthProvider, RequireAdmin, RequireAuth } from './lib/auth';
import { EditOSPage } from './pages/EditOSPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NewOSPage } from './pages/NewOSPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OSDetailPage } from './pages/OSDetailPage';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Tudo abaixo exige login. */}
          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/os/:id" element={<OSDetailPage />} />

              {/* Cadastrar/editar: somente administrador. */}
              <Route element={<RequireAdmin />}>
                <Route path="/os/nova" element={<NewOSPage />} />
                <Route path="/os/:id/editar" element={<EditOSPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
