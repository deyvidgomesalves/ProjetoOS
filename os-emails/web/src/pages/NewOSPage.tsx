import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OSForm } from '../components/OSForm';
import { useToast } from '../components/Toast';
import { api, type OSPayload } from '../lib/api';
import { createEmailRow } from '../lib/emails';
import type { OSFormValues } from '../types';

const createEmptyValues = (): OSFormValues => ({
  numero_os: '',
  cliente: '',
  obra: '',
  observacao: '',
  emails: [createEmailRow()],
});

/** Tela de cadastro de uma nova OS. */
export function NewOSPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [fornecedores, setFornecedores] = useState<string[]>([]);

  useEffect(() => {
    api
      .listFornecedores()
      .then((response) => setFornecedores(response.items))
      .catch(() => setFornecedores([]));
  }, []);

  const handleSubmit = async (payload: OSPayload) => {
    const created = await api.createOrder(payload);
    toast.success(`OS ${created.numero_os} cadastrada com ${created.emails.length} e-mail(s).`);
    navigate(`/os/${created.id}`, { replace: true });
  };

  return (
    <OSForm
      title="Nova OS"
      description="Cadastre a ordem de serviço e os e-mails do cliente (com o fornecedor de cada um)."
      submitLabel="Salvar OS"
      initialValues={createEmptyValues()}
      fornecedoresConhecidos={fornecedores}
      onSubmit={handleSubmit}
      onCancel={() => navigate('/')}
    />
  );
}
