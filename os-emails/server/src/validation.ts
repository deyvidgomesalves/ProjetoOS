/** Regras de validação/normalização dos dados recebidos pela API. */

export const LIMITS = {
  numeroOs: 60,
  cliente: 160,
  obra: 120,
  observacao: 2000,
  nome: 120,
  email: 200,
  fornecedor: 120,
  maxEmails: 50,
} as const;

/** Validação simples de e-mail: texto@texto.dominio */
export const EMAIL_REGEX = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;\s]{2,}$/;

export interface EmailInput {
  id?: number;
  nome: string | null;
  email: string;
  /** Obrigatório: cada e-mail pertence a um fornecedor. */
  fornecedor: string;
}

export interface OSInput {
  numero_os: string;
  cliente: string;
  obra: string;
  observacao: string | null;
  emails: EmailInput[];
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: string[] };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function readOptionalText(value: unknown): string | null {
  const text = readText(value);
  return text ? text : null;
}

/** Normaliza um e-mail: remove espaços e converte para minúsculas. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Separa uma lista de e-mails colada de uma vez ("a@x.com; b@y.com, c@z.com"). */
export function splitEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readEmails(value: unknown): { emails: EmailInput[]; errors: string[] } {
  const errors: string[] = [];
  if (value === undefined || value === null) return { emails: [], errors };

  if (!Array.isArray(value)) {
    return { emails: [], errors: ['O campo "emails" deve ser uma lista.'] };
  }

  if (value.length > LIMITS.maxEmails) {
    errors.push(`Máximo de ${LIMITS.maxEmails} e-mails por OS.`);
  }

  const emails: EmailInput[] = [];
  const seen = new Set<string>();

  value.slice(0, LIMITS.maxEmails).forEach((item, index) => {
    const record = asRecord(item);
    const email = normalizeEmail(readText(record.email));
    const nome = readOptionalText(record.nome);
    const fornecedor = readText(record.fornecedor);
    const position = index + 1;

    if (!email) {
      // Linhas em branco (adicionadas e não preenchidas) são simplesmente ignoradas.
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      errors.push(`E-mail ${position} inválido: "${email}".`);
      return;
    }

    if (email.length > LIMITS.email) {
      errors.push(`E-mail ${position} muito longo (máximo de ${LIMITS.email} caracteres).`);
      return;
    }

    if (!fornecedor) {
      errors.push(`Informe o fornecedor do e-mail ${position} (${email}).`);
      return;
    }

    if (fornecedor.length > LIMITS.fornecedor) {
      errors.push(`Fornecedor do e-mail ${position} muito longo (máximo de ${LIMITS.fornecedor} caracteres).`);
      return;
    }

    if (nome && nome.length > LIMITS.nome) {
      errors.push(`Nome ${position} muito longo (máximo de ${LIMITS.nome} caracteres).`);
      return;
    }

    if (seen.has(email)) {
      errors.push(`E-mail duplicado: "${email}".`);
      return;
    }
    seen.add(email);

    const id = typeof record.id === 'number' && Number.isFinite(record.id) && record.id > 0 ? record.id : undefined;
    emails.push({ id, nome, email, fornecedor });
  });

  return { emails, errors };
}

export function validateOSPayload(body: unknown): ValidationResult<OSInput> {
  const record = asRecord(body);
  const errors: string[] = [];

  const numero_os = readText(record.numero_os);
  const cliente = readText(record.cliente);
  const obra = readText(record.obra);
  const observacao = readOptionalText(record.observacao);

  if (!numero_os) errors.push('Informe o número da OS.');
  else if (numero_os.length > LIMITS.numeroOs) {
    errors.push(`Número da OS muito longo (máximo de ${LIMITS.numeroOs} caracteres).`);
  }

  if (!cliente) errors.push('Informe o cliente.');
  else if (cliente.length > LIMITS.cliente) {
    errors.push(`Cliente muito longo (máximo de ${LIMITS.cliente} caracteres).`);
  }

  if (!obra) errors.push('Informe a obra.');
  else if (obra.length > LIMITS.obra) {
    errors.push(`Obra muito longa (máximo de ${LIMITS.obra} caracteres).`);
  }

  if (observacao && observacao.length > LIMITS.observacao) {
    errors.push(`Observação muito longa (máximo de ${LIMITS.observacao} caracteres).`);
  }

  const parsedEmails = readEmails(record.emails);
  errors.push(...parsedEmails.errors);

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      numero_os,
      cliente,
      obra,
      observacao,
      emails: parsedEmails.emails,
    },
  };
}

export function validateEmailPayload(body: unknown): ValidationResult<EmailInput> {
  const record = asRecord(body);
  const errors: string[] = [];

  const email = normalizeEmail(readText(record.email));
  const nome = readOptionalText(record.nome);
  const fornecedor = readText(record.fornecedor);

  if (!email) errors.push('Informe o e-mail.');
  else if (!EMAIL_REGEX.test(email)) errors.push(`E-mail inválido: "${email}".`);
  else if (email.length > LIMITS.email) {
    errors.push(`E-mail muito longo (máximo de ${LIMITS.email} caracteres).`);
  }

  if (!fornecedor) errors.push('Informe o fornecedor.');
  else if (fornecedor.length > LIMITS.fornecedor) {
    errors.push(`Fornecedor muito longo (máximo de ${LIMITS.fornecedor} caracteres).`);
  }

  if (nome && nome.length > LIMITS.nome) {
    errors.push(`Nome muito longo (máximo de ${LIMITS.nome} caracteres).`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data: { nome, email, fornecedor } };
}
