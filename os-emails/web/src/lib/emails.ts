import type { Email, EmailFormValue } from '../types';

/** Validação simples de e-mail (mesma regra da API). */
export const EMAIL_REGEX = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;\s]{2,}$/;

/** Valor usado em e-mails cadastrados antes de existir o campo fornecedor. */
export const FORNECEDOR_NAO_INFORMADO = 'Não informado';

/** Opção que representa "todos os fornecedores" no filtro. */
export const TODOS_OS_FORNECEDORES = 'Todos';

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

/**
 * Monta o texto copiado para o Outlook: somente os e-mails, separados por "; ".
 * Ex.: "carlos@empresa.com.br; maria@empresa.com.br"
 */
export function joinEmailsForCopy(emails: readonly { email: string }[]): string {
  return emails
    .map((item) => item.email.trim())
    .filter(Boolean)
    .join('; ');
}

/** Separa um texto colado com vários e-mails: "a@x.com; b@y.com, c@z.com". */
export function splitEmailsText(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Remove repetidos (ignorando maiúsculas/minúsculas) mantendo a ordem. */
export function uniqueEmails(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.trim());
  }

  return result;
}

/**
 * Extrai os e-mails de um texto colado, aceitando os formatos mais comuns
 * do Outlook: "Carlos <carlos@empresa.com.br>; Maria <maria@empresa.com.br>"
 * ou simplesmente "carlos@empresa.com.br; maria@empresa.com.br".
 */
export function extractEmailsFromText(text: string): string[] {
  const inBrackets = Array.from(text.matchAll(/<([^<>\s]+@[^<>\s]+)>/g)).map((match) => match[1] ?? '');
  if (inBrackets.length > 0) {
    return uniqueEmails(inBrackets.filter((value) => isValidEmail(value)));
  }

  return uniqueEmails(splitEmailsText(text).filter((value) => isValidEmail(value)));
}

/** Iniciais para o avatar: usa o nome quando existir, senão o começo do e-mail. */
export function emailInitials(nome: string | null | undefined, email: string): string {
  const name = (nome ?? '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
    return `${first}${last}`.toUpperCase() || name.slice(0, 2).toUpperCase();
  }
  return email.trim().slice(0, 2).toUpperCase();
}

let rowCounter = 0;

export function createEmailRow(nome = '', email = '', fornecedor = ''): EmailFormValue {
  rowCounter += 1;
  return { key: `email-${Date.now()}-${rowCounter}`, nome, email, fornecedor };
}

export function toEmailRows(emails: readonly Email[]): EmailFormValue[] {
  return emails.map((item) => ({
    id: item.id,
    key: `email-${item.id}`,
    nome: item.nome ?? '',
    email: item.email,
    fornecedor: item.fornecedor ?? '',
  }));
}

export interface EmailRowError {
  nome?: string;
  email?: string;
  fornecedor?: string;
}

/** Valida as linhas de e-mail do formulário (linhas totalmente vazias são ignoradas). */
export function validateEmailRows(rows: readonly EmailFormValue[]): Record<string, EmailRowError> {
  const errors: Record<string, EmailRowError> = {};
  const seen = new Map<string, string>();

  for (const row of rows) {
    const email = row.email.trim();
    const nome = row.nome.trim();
    const fornecedor = row.fornecedor.trim();
    if (!email && !nome && !fornecedor) continue;

    const rowErrors: EmailRowError = {};

    if (!email) {
      rowErrors.email = 'Informe o e-mail.';
    } else if (!isValidEmail(email)) {
      rowErrors.email = 'E-mail inválido.';
    } else {
      const normalized = email.toLowerCase();
      const duplicatedAt = seen.get(normalized);
      if (duplicatedAt) {
        rowErrors.email = 'E-mail repetido.';
      } else {
        seen.set(normalized, row.key);
      }
    }

    // O fornecedor é obrigatório.
    if (!fornecedor) {
      rowErrors.fornecedor = 'Informe o fornecedor.';
    }

    if (Object.keys(rowErrors).length > 0) errors[row.key] = rowErrors;
  }

  return errors;
}

/* ------------------------------------------------- Fornecedores / filtro --- */

/** Lista os fornecedores presentes naquela OS (para o filtro e para as sugestões). */
export function listFornecedores(emails: readonly { fornecedor: string | null }[]): string[] {
  const unique = new Map<string, string>();

  for (const item of emails) {
    const value = (item.fornecedor ?? '').trim() || FORNECEDOR_NAO_INFORMADO;
    const key = value.toLowerCase();
    if (!unique.has(key)) unique.set(key, value);
  }

  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Aplica o filtro de fornecedor ("Todos" devolve a lista completa). */
export function filterEmailsByFornecedor<T extends { fornecedor: string | null }>(
  emails: readonly T[],
  fornecedor: string,
): T[] {
  const target = (fornecedor ?? '').trim();
  if (!target || target === TODOS_OS_FORNECEDORES) return [...emails];

  return emails.filter((item) => ((item.fornecedor ?? '').trim() || FORNECEDOR_NAO_INFORMADO) === target);
}

/** Texto do botão grande: muda quando existe um fornecedor selecionado. */
export function copyAllButtonLabel(fornecedor: string): string {
  const filtered = Boolean((fornecedor ?? '').trim()) && fornecedor !== TODOS_OS_FORNECEDORES;
  return filtered ? 'COPIAR E-MAILS DO FORNECEDOR' : 'COPIAR TODOS OS E-MAILS';
}

/** Mensagem mostrada depois de copiar. */
export function copyAllSuccessMessage(fornecedor: string, total: number): string {
  const filtered = Boolean((fornecedor ?? '').trim()) && fornecedor !== TODOS_OS_FORNECEDORES;
  if (filtered) {
    return `✓ E-mails do fornecedor "${fornecedor}" foram copiados! (${total})`;
  }
  return '✓ Todos os e-mails foram copiados!';
}
