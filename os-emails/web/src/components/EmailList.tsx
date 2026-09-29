import { useMemo, useState, type FormEvent } from 'react';
import type { Email } from '../types';
import { copyText } from '../lib/clipboard';
import {
  FORNECEDOR_NAO_INFORMADO,
  TODOS_OS_FORNECEDORES,
  copyAllButtonLabel,
  copyAllSuccessMessage,
  emailInitials,
  filterEmailsByFornecedor,
  isValidEmail,
  joinEmailsForCopy,
  listFornecedores,
} from '../lib/emails';
import { formatDateTime } from '../lib/format';
import { CheckIcon, ClipboardIcon, CopyIcon, FilterIcon, MailIcon, PlusIcon, TrashIcon } from './Icons';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';
import { Badge, Button, Card, CardHeader, Field, Input, Select } from './ui';

export interface EmailListProps {
  emails: Email[];
  /** false para o perfil de consulta: esconde adicionar/remover e-mail. */
  canEdit: boolean;
  /** Fornecedores já cadastrados no sistema (sugestões ao incluir um e-mail). */
  fornecedoresConhecidos: string[];
  onAddEmail: (nome: string | null, email: string, fornecedor: string) => Promise<void>;
  onDeleteEmail: (id: number) => Promise<void>;
}

/**
 * Lista de e-mails da OS com:
 *  - filtro por fornecedor;
 *  - cópia individual;
 *  - botão "copiar todos" que respeita o filtro selecionado.
 */
export function EmailList({
  emails,
  canEdit,
  fornecedoresConhecidos,
  onAddEmail,
  onDeleteEmail,
}: EmailListProps) {
  const toast = useToast();
  const [fornecedorFiltro, setFornecedorFiltro] = useState<string>(TODOS_OS_FORNECEDORES);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFornecedor, setNewFornecedor] = useState('');
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Email | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fornecedores = useMemo(() => listFornecedores(emails), [emails]);
  const emailsVisiveis = useMemo(
    () => filterEmailsByFornecedor(emails, fornecedorFiltro),
    [emails, fornecedorFiltro],
  );
  const copiandoFiltrado = fornecedorFiltro !== TODOS_OS_FORNECEDORES;
  const copyAllText = joinEmailsForCopy(emailsVisiveis);

  const handleCopyOne = async (item: Email) => {
    const ok = await copyText(item.email);
    if (!ok) {
      toast.error('Não foi possível copiar. Copie manualmente: ' + item.email);
      return;
    }
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1800);
    toast.success(`E-mail copiado: ${item.email}`);
  };

  const handleCopyAll = async () => {
    if (emailsVisiveis.length === 0) {
      toast.info(
        copiandoFiltrado
          ? `Nenhum e-mail do fornecedor "${fornecedorFiltro}" para copiar.`
          : 'Esta OS ainda não tem e-mails cadastrados.',
      );
      return;
    }
    const ok = await copyText(copyAllText);
    if (!ok) {
      toast.error('Não foi possível copiar os e-mails.');
      return;
    }
    setCopiedAll(true);
    window.setTimeout(() => setCopiedAll(false), 2000);
    toast.success(copyAllSuccessMessage(fornecedorFiltro, emailsVisiveis.length));
  };

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = newEmail.trim();
    const fornecedor = newFornecedor.trim();

    if (!email) {
      setFormError('Informe o e-mail.');
      return;
    }
    if (!isValidEmail(email)) {
      setFormError('E-mail inválido.');
      return;
    }
    if (!fornecedor) {
      setFormError('Informe o fornecedor.');
      return;
    }
    if (emails.some((item) => item.email.toLowerCase() === email.toLowerCase())) {
      setFormError('Este e-mail já está cadastrado nesta OS.');
      return;
    }

    setFormError(null);
    setAdding(true);
    try {
      await onAddEmail(newName.trim() ? newName.trim() : null, email, fornecedor);
      setNewName('');
      setNewEmail('');
      setNewFornecedor('');
      toast.success('E-mail adicionado.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível adicionar o e-mail.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await onDeleteEmail(pendingDelete.id);
      toast.success('E-mail removido.');
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível remover o e-mail.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Botão grande de copiar todos */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-sky-600 p-4 shadow-lg shadow-indigo-500/20 sm:p-5">
        <Button
          size="lg"
          className={`w-full ${
            copiedAll
              ? 'bg-emerald-500 text-white hover:bg-emerald-500'
              : 'bg-white/95 text-indigo-700 hover:bg-white disabled:bg-white/70'
          }`}
          onClick={() => void handleCopyAll()}
          disabled={emailsVisiveis.length === 0}
          icon={copiedAll ? <CheckIcon className="h-5 w-5" /> : <ClipboardIcon className="h-5 w-5" />}
        >
          {copiedAll ? '✓ E-MAILS COPIADOS!' : copyAllButtonLabel(fornecedorFiltro)}
        </Button>

        {copiedAll ? (
          <p className="mt-3 text-center text-sm font-bold text-white">
            {copyAllSuccessMessage(fornecedorFiltro, emailsVisiveis.length)}
          </p>
        ) : (
          <p className="mt-3 text-center text-xs font-medium text-indigo-50/90">
            {emailsVisiveis.length > 0
              ? copiandoFiltrado
                ? `Somente os ${emailsVisiveis.length} e-mail(s) do fornecedor "${fornecedorFiltro}" — separados por ponto e vírgula.`
                : `${emailsVisiveis.length} e-mail(s) separados por ponto e vírgula — pronto para colar em "Para" ou "CC" do Outlook.`
              : copiandoFiltrado
                ? `Nenhum e-mail do fornecedor "${fornecedorFiltro}".`
                : 'Cadastre pelo menos um e-mail para liberar a cópia.'}
          </p>
        )}

        {copyAllText ? (
          <p className="mt-2 truncate rounded-xl bg-white/10 px-3 py-2 font-mono text-xs text-indigo-50" title={copyAllText}>
            {copyAllText}
          </p>
        ) : null}
      </div>

      {/* E-mails cadastrados */}
      <Card>
        <CardHeader
          title="E-mails"
          description={
            emails.length > 0
              ? `${emailsVisiveis.length} de ${emails.length} e-mail(s) exibido(s)`
              : 'Nenhum e-mail cadastrado ainda'
          }
          icon={<MailIcon className="h-4.5 w-4.5" />}
          action={
            fornecedores.length > 0 ? (
              <label className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  <FilterIcon className="h-4 w-4 text-slate-400" />
                  Fornecedor:
                </span>
                <Select
                  value={fornecedorFiltro}
                  onChange={(event) => setFornecedorFiltro(event.target.value)}
                  className="w-auto border-slate-300 py-1.5 text-sm font-semibold"
                  aria-label="Filtrar e-mails por fornecedor"
                >
                  <option value={TODOS_OS_FORNECEDORES}>{TODOS_OS_FORNECEDORES}</option>
                  {fornecedores.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </Select>
              </label>
            ) : undefined
          }
        />

        {emailsVisiveis.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            {emails.length === 0
              ? canEdit
                ? 'Use o campo abaixo para adicionar os e-mails deste cliente.'
                : 'Esta OS ainda não tem e-mails cadastrados.'
              : `Nenhum e-mail do fornecedor "${fornecedorFiltro}" nesta OS.`}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50/80 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <th scope="col" className="px-5 py-3">
                    Nome
                  </th>
                  <th scope="col" className="px-5 py-3">
                    E-mail
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Fornecedor
                  </th>
                  <th scope="col" className="px-5 py-3 text-right">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {emailsVisiveis.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-600">
                          {emailInitials(item.nome, item.email)}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">
                          {item.nome ?? <span className="font-normal text-slate-400 italic">Sem nome</span>}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-slate-700" title={item.email}>
                        {item.email}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        cadastrado em {formatDateTime(item.created_at)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge tone={item.fornecedor === FORNECEDOR_NAO_INFORMADO ? 'neutral' : 'sky'}>
                        {item.fornecedor}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant={copiedId === item.id ? 'success' : 'secondary'}
                          onClick={() => void handleCopyOne(item)}
                          icon={copiedId === item.id ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                        >
                          {copiedId === item.id ? 'Copiado' : 'Copiar'}
                        </Button>

                        {/* Remover e-mail: somente administrador. */}
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setPendingDelete(item)}
                            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Remover e-mail ${item.email}`}
                            title="Remover e-mail"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Inclusão de e-mails: somente administrador. */}
        {canEdit ? (
          <form
            onSubmit={(event) => void handleAdd(event)}
            className="border-t border-slate-200 bg-slate-50/70 px-5 py-4"
          >
            <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Adicionar e-mail</p>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,11rem)_auto] sm:items-end">
              <Field label="Nome (opcional)" htmlFor="novo-email-nome">
                <Input
                  id="novo-email-nome"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Carlos"
                  autoComplete="off"
                />
              </Field>

              <Field label="E-mail" htmlFor="novo-email-endereco">
                <Input
                  id="novo-email-endereco"
                  type="email"
                  value={newEmail}
                  onChange={(event) => {
                    setNewEmail(event.target.value);
                    setFormError(null);
                  }}
                  placeholder="carlos@empresa.com.br"
                  autoComplete="off"
                  invalid={Boolean(formError)}
                />
              </Field>

              <Field label="Fornecedor" htmlFor="novo-email-fornecedor" required>
                <Input
                  id="novo-email-fornecedor"
                  list="fornecedores-conhecidos"
                  value={newFornecedor}
                  onChange={(event) => {
                    setNewFornecedor(event.target.value);
                    setFormError(null);
                  }}
                  placeholder="Priner"
                  autoComplete="off"
                  invalid={Boolean(formError)}
                />
                <datalist id="fornecedores-conhecidos">
                  {fornecedoresConhecidos.map((nome) => (
                    <option key={nome} value={nome} />
                  ))}
                </datalist>
              </Field>

              <Button type="submit" loading={adding} icon={<PlusIcon className="h-4 w-4" />} className="h-[42px]">
                Adicionar
              </Button>
            </div>

          {formError ? <p className="mt-2 text-xs font-medium text-rose-600">{formError}</p> : null}
          </form>
        ) : null}
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remover este e-mail?"
        message={pendingDelete ? `O e-mail ${pendingDelete.email} será removido desta OS.` : ''}
        confirmLabel="Remover"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
