import { useState, type ClipboardEvent, type FormEvent } from 'react';
import type { EmailFormValue, OSFormValues } from '../types';
import { ApiError, type OSPayload } from '../lib/api';
import { createEmailRow, extractEmailsFromText, validateEmailRows, type EmailRowError } from '../lib/emails';
import { AlertIcon, BuildingIcon, CloseIcon, MailIcon, PlusIcon } from './Icons';
import { Badge, Button, Callout, Card, CardHeader, Field, Input, Textarea } from './ui';

export interface OSFormProps {
  title: string;
  description: string;
  submitLabel: string;
  initialValues: OSFormValues;
  /** Fornecedores já cadastrados, para sugerir no campo (pode selecionar ou digitar). */
  fornecedoresConhecidos: string[];
  onSubmit: (payload: OSPayload) => Promise<void>;
  onCancel: () => void;
  /** Exclusão opcional (aparece apenas na edição). */
  onDelete?: () => void;
}

/** Id do <datalist> com os fornecedores já cadastrados (permite selecionar ou digitar). */
const FORNECEDORES_DATALIST_ID = 'fornecedores-cadastrados';

interface FieldErrors {
  numero_os?: string;
  cliente?: string;
  obra?: string;
}

function payloadFromValues(values: OSFormValues): OSPayload {
  return {
    numero_os: values.numero_os.trim(),
    cliente: values.cliente.trim(),
    obra: values.obra.trim(),
    observacao: values.observacao.trim() ? values.observacao.trim() : null,
    emails: values.emails
      .filter((row) => row.email.trim() || row.nome.trim() || row.fornecedor.trim())
      .map((row) => ({
        ...(row.id ? { id: row.id } : {}),
        nome: row.nome.trim() ? row.nome.trim() : null,
        email: row.email.trim().toLowerCase(),
        fornecedor: row.fornecedor.trim(),
      })),
  };
}

/** Formulário de cadastro/edição da OS com vários e-mails e fornecedor. */
export function OSForm({
  title,
  description,
  submitLabel,
  initialValues,
  fornecedoresConhecidos,
  onSubmit,
  onCancel,
  onDelete,
}: OSFormProps) {
  const [values, setValues] = useState<OSFormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [rowErrors, setRowErrors] = useState<Record<string, EmailRowError>>({});
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const updateField = (field: 'numero_os' | 'cliente' | 'obra' | 'observacao', value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    if (field !== 'observacao') {
      setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    }
  };

  const updateEmailRow = (key: string, patch: Partial<EmailFormValue>) => {
    setValues((previous) => ({
      ...previous,
      emails: previous.emails.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }));
    setRowErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const addEmailRow = () => {
    setValues((previous) => ({ ...previous, emails: [...previous.emails, createEmailRow()] }));
  };

  const removeEmailRow = (key: string) => {
    setValues((previous) => ({ ...previous, emails: previous.emails.filter((row) => row.key !== key) }));
    setRowErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  /** Colar uma lista de e-mails ("a@x.com; b@y.com") cria uma linha para cada um. */
  const handleEmailPaste = (key: string, event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    const found = extractEmailsFromText(text).slice(0, 50);
    if (found.length <= 1) return;

    event.preventDefault();
    setValues((previous) => {
      const index = previous.emails.findIndex((row) => row.key === key);
      if (index === -1) return previous;

      const emails = [...previous.emails];
      const current = emails[index]!;
      emails[index] = { ...current, email: found[0]! };
      emails.splice(index + 1, 0, ...found.slice(1).map((email) => createEmailRow('', email)));
      return { ...previous, emails };
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextFieldErrors: FieldErrors = {};
    if (!values.numero_os.trim()) nextFieldErrors.numero_os = 'Informe o número da OS.';
    if (!values.cliente.trim()) nextFieldErrors.cliente = 'Informe o cliente.';
    if (!values.obra.trim()) nextFieldErrors.obra = 'Informe a obra.';

    const nextRowErrors = validateEmailRows(values.emails);
    setFieldErrors(nextFieldErrors);
    setRowErrors(nextRowErrors);
    setServerErrors([]);

    if (Object.keys(nextFieldErrors).length > 0 || Object.keys(nextRowErrors).length > 0) return;

    setSaving(true);
    try {
      await onSubmit(payloadFromValues(values));
    } catch (error) {
      if (error instanceof ApiError) {
        setServerErrors(error.details.length > 0 ? error.details : [error.message]);
      } else {
        setServerErrors([error instanceof Error ? error.message : 'Não foi possível salvar a OS.']);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };


  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <Badge tone="indigo">
          <MailIcon className="h-3.5 w-3.5" />
          {values.emails.length} e-mail(s)
        </Badge>
      </div>

      {serverErrors.length > 0 ? <Callout title="Não foi possível salvar:" items={serverErrors} /> : null}

      {/* Dados da OS */}
      <Card>
        <CardHeader
          title="Dados da OS"
          description="Informe os dados básicos da ordem de serviço."
          icon={<BuildingIcon className="h-4.5 w-4.5" />}
        />

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Número da OS" htmlFor="numero_os" required error={fieldErrors.numero_os}>
            <Input
              id="numero_os"
              value={values.numero_os}
              onChange={(event) => updateField('numero_os', event.target.value)}
              placeholder="12345"
              invalid={Boolean(fieldErrors.numero_os)}
              autoComplete="off"
              autoFocus
            />
          </Field>

          <Field label="Cliente" htmlFor="cliente" required error={fieldErrors.cliente}>
            <Input
              id="cliente"
              value={values.cliente}
              onChange={(event) => updateField('cliente', event.target.value)}
              placeholder="Empresa ABC"
              invalid={Boolean(fieldErrors.cliente)}
              autoComplete="off"
            />
          </Field>

          <Field label="Obra" htmlFor="obra" required error={fieldErrors.obra} className="sm:col-span-2">
            <Input
              id="obra"
              value={values.obra}
              onChange={(event) => updateField('obra', event.target.value)}
              placeholder="Obra XPTO"
              invalid={Boolean(fieldErrors.obra)}
              autoComplete="off"
            />
          </Field>

          <Field
            label="Observação (opcional)"
            htmlFor="observacao"
            hint="Campo livre para anotações rápidas sobre esta OS."
            className="sm:col-span-2"
          >
            <Textarea
              id="observacao"
              value={values.observacao}
              onChange={(event) => updateField('observacao', event.target.value)}
              placeholder="Ex.: cliente pediu retorno por e-mail após o término do serviço."
            />
          </Field>
        </div>
      </Card>


      {/* E-mails do cliente */}
      <Card>
        <CardHeader
          title="E-mails do cliente"
          description="Adicione quantos e-mails quiser. O nome é opcional."
          icon={<MailIcon className="h-4.5 w-4.5" />}
          action={
            <Button variant="secondary" size="sm" icon={<PlusIcon className="h-4 w-4" />} onClick={addEmailRow}>
              Adicionar e-mail
            </Button>
          }
        />

        {/* Sugestões de fornecedor: pode selecionar um já usado ou digitar um novo. */}
        <datalist id={FORNECEDORES_DATALIST_ID}>
          {fornecedoresConhecidos.map((nome) => (
            <option key={nome} value={nome} />
          ))}
        </datalist>

        <div className="flex flex-col gap-3 p-5">
          {values.emails.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Nenhum e-mail informado. Clique em <strong>Adicionar e-mail</strong> para incluir os contatos deste
              cliente.
            </p>
          ) : null}

          {values.emails.map((row) => (
            <div key={row.key} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,12rem)_auto] sm:items-end">
                <Field label="Nome (opcional)" htmlFor={`nome-${row.key}`}>
                  <Input
                    id={`nome-${row.key}`}
                    value={row.nome}
                    onChange={(event) => updateEmailRow(row.key, { nome: event.target.value })}
                    placeholder="Carlos"
                    autoComplete="off"
                  />
                </Field>

                <Field
                  label="E-mail"
                  htmlFor={`email-${row.key}`}
                  error={rowErrors[row.key]?.email}
                  hint="Dica: cole vários e-mails de uma vez e eles virarão linhas separadas."
                >
                  <Input
                    id={`email-${row.key}`}
                    type="email"
                    value={row.email}
                    onChange={(event) => updateEmailRow(row.key, { email: event.target.value })}
                    onPaste={(event) => handleEmailPaste(row.key, event)}
                    placeholder="carlos@empresa.com.br"
                    autoComplete="off"
                    invalid={Boolean(rowErrors[row.key]?.email)}
                    className="font-mono"
                  />
                </Field>

                <Field
                  label="Fornecedor"
                  htmlFor={`fornecedor-${row.key}`}
                  required
                  error={rowErrors[row.key]?.fornecedor}
                  hint="Escolha um já cadastrado ou digite um novo."
                >
                  <Input
                    id={`fornecedor-${row.key}`}
                    list={FORNECEDORES_DATALIST_ID}
                    value={row.fornecedor}
                    onChange={(event) => updateEmailRow(row.key, { fornecedor: event.target.value })}
                    placeholder="Priner"
                    autoComplete="off"
                    invalid={Boolean(rowErrors[row.key]?.fornecedor)}
                  />
                </Field>

                <button
                  type="button"
                  onClick={() => removeEmailRow(row.key)}
                  className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Remover este e-mail"
                >
                  <CloseIcon className="h-4 w-4" />
                  Remover
                </button>
              </div>
            </div>
          ))}

          <Button
            variant="secondary"
            icon={<PlusIcon className="h-4 w-4" />}
            onClick={addEmailRow}
            className="border-dashed"
          >
            + Adicionar e-mail
          </Button>

          <p className="flex items-start gap-2 text-xs text-slate-500">
            <AlertIcon className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-500" />
            Nome é opcional, mas o <strong>fornecedor é obrigatório</strong> em cada e-mail. Linhas em branco são
            ignoradas ao salvar e e-mails repetidos não são aceitos.
          </p>
        </div>
      </Card>


      {/* Ações */}
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" loading={saving}>
            {saving ? 'Salvando...' : submitLabel}
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        </div>

        {onDelete ? (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving}>
            Excluir OS
          </Button>
        ) : null}
      </div>
    </form>
  );
}
