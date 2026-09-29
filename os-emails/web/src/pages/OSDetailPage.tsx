import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmailList } from '../components/EmailList';
import { ArrowLeftIcon, BuildingIcon, PencilIcon, TrashIcon } from '../components/Icons';
import { useToast } from '../components/Toast';
import { Badge, Button, Callout, Card, CardHeader, SkeletonRows } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDateTime, pluralize } from '../lib/format';
import type { ServiceOrderWithEmails } from '../types';

/** Detalhes da OS: dados, e-mails (com filtro por fornecedor) e cópia rápida. */
export function OSDetailPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();

  const [order, setOrder] = useState<ServiceOrderWithEmails | null>(null);
  const [fornecedoresConhecidos, setFornecedoresConhecidos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const response = await api.getOrder(orderId);
    setOrder(response);
  }, [orderId]);

  useEffect(() => {
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      setError('OS inválida.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    api
      .getOrder(orderId)
      .then((response) => {
        if (active) {
          setOrder(response);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar a OS.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Sugestões de fornecedor para o formulário rápido de inclusão.
    api
      .listFornecedores()
      .then((response) => {
        if (active) setFornecedoresConhecidos(response.items);
      })
      .catch(() => {
        /* sugestões são opcionais */
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  const handleAddEmail = async (nome: string | null, email: string, fornecedor: string) => {
    await api.addEmail(orderId, { nome, email, fornecedor });
    await load();
    await api
      .listFornecedores()
      .then((response) => setFornecedoresConhecidos(response.items))
      .catch(() => undefined);
  };

  const handleDeleteEmail = async (emailId: number) => {
    await api.deleteEmail(emailId);
    await load();
  };

  const handleDeleteOrder = async () => {
    setDeleting(true);
    try {
      await api.deleteOrder(orderId);
      navigate('/', { replace: true, state: { flash: 'OS excluída com sucesso.' } });
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Não foi possível excluir a OS.');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <SkeletonRows rows={5} />
      </Card>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col gap-4">
        <Callout title="Não foi possível abrir a OS" items={[error ?? 'OS não encontrada.']} />
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para a lista
        </Link>
      </div>
    );
  }


  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para a lista
        </Link>

        <div className="flex flex-wrap gap-2">
          {/* Editar/excluir aparecem somente para o administrador. */}
          {isAdmin ? (
            <>
              <Button
                variant="secondary"
                icon={<PencilIcon className="h-4 w-4" />}
                onClick={() => navigate(`/os/${order.id}/editar`)}
              >
                Editar OS
              </Button>
              <Button
                variant="danger"
                icon={<TrashIcon className="h-4 w-4" />}
                onClick={() => setConfirmDelete(true)}
              >
                Excluir OS
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Cabeçalho da OS */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-sky-600 px-5 py-5 text-white sm:px-6">
          <p className="text-xs font-semibold tracking-widest text-indigo-100 uppercase">Ordem de serviço</p>
          <h1 className="mt-1 font-mono text-3xl font-bold tracking-tight break-all">{order.numero_os}</h1>
        </div>

        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Cliente</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{order.cliente}</p>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Obra</p>
            <p className="mt-1">
              <Badge tone="indigo" className="text-sm">
                <BuildingIcon className="h-3.5 w-3.5" />
                {order.obra}
              </Badge>
            </p>
          </div>

          <div className="sm:col-span-2">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Observação</p>
            <p className="mt-1 text-sm whitespace-pre-line text-slate-700">
              {order.observacao ?? <span className="text-slate-400 italic">Sem observações.</span>}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4 text-xs text-slate-500 sm:col-span-2">
            {pluralize(order.emails.length, 'e-mail cadastrado', 'e-mails cadastrados')} • criada em{' '}
            {formatDateTime(order.created_at)} • última alteração em {formatDateTime(order.updated_at)}
          </div>
        </div>
      </Card>

      {/* Botão grande de copiar todos (respeitando o filtro) + lista de e-mails */}
      <EmailList
        emails={order.emails}
        canEdit={isAdmin}
        fornecedoresConhecidos={fornecedoresConhecidos}
        onAddEmail={handleAddEmail}
        onDeleteEmail={handleDeleteEmail}
      />

      <Card>
        <CardHeader title="Sobre a cópia" description="Como usar os e-mails no Outlook" />
        <p className="px-5 py-4 text-sm text-slate-600">
          O botão <strong>Copiar todos os e-mails</strong> coloca na área de transferência apenas os endereços,
          separados por ponto e vírgula (ex.:{' '}
          <span className="font-mono text-xs">a@empresa.com; b@empresa.com</span>). Basta colar no campo{' '}
          <strong>Para</strong> ou <strong>CC</strong> do Outlook. Quando um fornecedor está selecionado no filtro,
          o botão copia <strong>somente os e-mails daquele fornecedor</strong>.
        </p>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Tem certeza que deseja excluir esta OS?"
        message={`A OS ${order.numero_os} e todos os ${order.emails.length} e-mail(s) vinculados serão apagados. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir OS"
        loading={deleting}
        onConfirm={() => void handleDeleteOrder()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
