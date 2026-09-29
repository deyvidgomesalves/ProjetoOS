import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PlusIcon } from '../components/Icons';
import { OSTable } from '../components/OSTable';
import { SearchBar } from '../components/SearchBar';
import { useToast } from '../components/Toast';
import { Button, Callout } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { pluralize } from '../lib/format';
import type { ServiceOrderListItem } from '../types';

interface FlashState {
  flash?: string;
}

/** Tela principal: pesquisa e lista de OS. */
export function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user, isAdmin } = useAuth();

  const [term, setTerm] = useState('');
  const [items, setItems] = useState<ServiceOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mensagem enviada por outras telas (OS salva, excluída...).
  useEffect(() => {
    const state = location.state as FlashState | null;
    if (state?.flash) {
      toast.success(state.flash);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate, toast]);

  // Pesquisa com um pequeno atraso para não consultar a cada tecla digitada.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(() => {
      api
        .listOrders(term, controller.signal)
        .then((response) => {
          setItems(response.items);
          setError(null);
        })
        .catch((requestError: unknown) => {
          if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
          setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar as OS.');
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ordens de Serviço</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pesquise por número da OS, cliente, obra ou fornecedor e abra a OS para ver e copiar os e-mails.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isAdmin && user ? (
            <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 shadow-sm">
              Perfil de consulta: apenas pesquisar, abrir e copiar e-mails.
            </span>
          ) : null}

          {/* O cadastro aparece apenas para o administrador. */}
          {isAdmin ? (
            <Button size="lg" icon={<PlusIcon className="h-5 w-5" />} onClick={() => navigate('/os/nova')}>
              Nova OS
            </Button>
          ) : null}
        </div>
      </div>

      <SearchBar value={term} onChange={setTerm} loading={loading} />

      {error ? <Callout title="Erro ao carregar as OS" items={[error]} /> : null}

      <div className="flex items-center justify-between px-1 text-sm text-slate-500">
        <span>
          {loading && items.length === 0
            ? 'Carregando...'
            : term
              ? `${pluralize(items.length, 'resultado', 'resultados')} para "${term}"`
              : `${pluralize(items.length, 'OS cadastrada', 'OS cadastradas')}`}
        </span>
        {!loading && items.length > 0 ? <span className="text-xs text-slate-400">Clique na linha para abrir</span> : null}
      </div>

      <OSTable
        items={items}
        loading={loading && items.length === 0}
        searchTerm={term}
        onOpen={(id) => navigate(`/os/${id}`)}
        onCreate={isAdmin ? () => navigate('/os/nova') : undefined}
      />
    </div>
  );
}
