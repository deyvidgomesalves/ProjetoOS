import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ArrowLeftIcon } from '../components/Icons';
import { OSForm } from '../components/OSForm';
import { useToast } from '../components/Toast';
import { Callout, Card, SkeletonRows } from '../components/ui';
import { api, type OSPayload } from '../lib/api';
import { toEmailRows } from '../lib/emails';
import type { OSFormValues, ServiceOrderWithEmails } from '../types';

/** Tela de edição de uma OS (dados + e-mails). */
export function EditOSPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [order, setOrder] = useState<ServiceOrderWithEmails | null>(null);
  const [fornecedoresConhecidos, setFornecedoresConhecidos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleSubmit = async (payload: OSPayload) => {
    const updated = await api.updateOrder(orderId, payload);
    toast.success(`OS ${updated.numero_os} atualizada.`);
    navigate(`/os/${updated.id}`, { replace: true });
  };

  const handleDelete = async () => {
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

  const initialValues: OSFormValues = {
    numero_os: order.numero_os,
    cliente: order.cliente,
    obra: order.obra,
    observacao: order.observacao ?? '',
    emails: toEmailRows(order.emails),
  };

  return (
    <>
      <div className="mb-4">
        <Link
          to={`/os/${order.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para os detalhes
        </Link>
      </div>

      <OSForm
        title={`Editar OS ${order.numero_os}`}
        description="Altere os dados da OS e gerencie os e-mails vinculados (com seus fornecedores)."
        submitLabel="Salvar alterações"
        initialValues={initialValues}
        fornecedoresConhecidos={fornecedoresConhecidos}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/os/${order.id}`)}
        onDelete={() => setConfirmDelete(true)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Tem certeza que deseja excluir esta OS?"
        message={`A OS ${order.numero_os} e todos os ${order.emails.length} e-mail(s) vinculados serão apagados. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir OS"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
