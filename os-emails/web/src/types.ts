/** Tipos usados na interface (iguais aos devolvidos pela API). */

export type Role = 'admin' | 'user';

export interface SessionUser {
  username: string;
  name: string;
  role: Role;
}

export interface Email {
  id: number;
  os_id: number;
  nome: string | null;
  email: string;
  /** Fornecedor do e-mail (obrigatório no cadastro). */
  fornecedor: string;
  created_at: string;
}

export interface ServiceOrder {
  id: number;
  numero_os: string;
  cliente: string;
  obra: string;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderWithEmails extends ServiceOrder {
  emails: Email[];
}

export interface ServiceOrderListItem extends ServiceOrder {
  email_count: number;
}

export interface EmailFormValue {
  /** Id do e-mail já salvo (usado na edição). Ausente em e-mails novos. */
  id?: number;
  /** Chave local usada apenas na interface. */
  key: string;
  nome: string;
  email: string;
  fornecedor: string;
}

export interface OSFormValues {
  numero_os: string;
  cliente: string;
  obra: string;
  observacao: string;
  emails: EmailFormValue[];
}

export interface OSListResponse {
  items: ServiceOrderListItem[];
  total: number;
  query: string;
}
