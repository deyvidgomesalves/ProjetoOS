import type { Email, OSListResponse, ServiceOrderWithEmails, SessionUser } from '../types';

export interface EmailPayload {
  id?: number;
  nome: string | null;
  email: string;
  fornecedor: string;
}

export interface OSPayload {
  numero_os: string;
  cliente: string;
  obra: string;
  observacao: string | null;
  emails: EmailPayload[];
}

/** Base da API. Vazio = mesma origem (deploy único) ou o domínio informado em VITE_API_URL. */
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(message: string, status: number, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      ...init,
      // Envia/recebe o cookie de sessão do login.
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Verifique se a API está rodando.', 0);
  }

  if (response.status === 401 && !path.startsWith('/auth/')) {
    // A sessão caiu (expirou ou usuário desconectado): a interface volta para o login.
    window.dispatchEvent(new Event('os-emails:unauthorized'));
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = (payload ?? {}) as { error?: string; details?: string[] };
    throw new ApiError(body.error ?? `Erro ${response.status} ao acessar o servidor.`, response.status, body.details ?? []);
  }

  return payload as T;
}

export const api = {
  /* ------------------------------------------------------------- Login --- */

  login(username: string, password: string): Promise<{ user: SessionUser }> {
    return request<{ user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  logout(): Promise<void> {
    return request<void>('/auth/logout', { method: 'POST' });
  },

  me(): Promise<{ user: SessionUser }> {
    return request<{ user: SessionUser }>('/auth/me');
  },

  /* --------------------------------------------------------------- OS --- */

  /** Pesquisa as OS por número, cliente, obra ou fornecedor. */
  listOrders(query: string, signal?: AbortSignal): Promise<OSListResponse> {
    const search = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    return request<OSListResponse>(`/os${search}`, { signal });
  },

  getOrder(id: number): Promise<ServiceOrderWithEmails> {
    return request<ServiceOrderWithEmails>(`/os/${id}`);
  },

  /** Fornecedores já cadastrados (sugestões no formulário de e-mails). */
  listFornecedores(): Promise<{ items: string[] }> {
    return request<{ items: string[] }>('/fornecedores');
  },

  createOrder(payload: OSPayload): Promise<ServiceOrderWithEmails> {
    return request<ServiceOrderWithEmails>('/os', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateOrder(id: number, payload: OSPayload): Promise<ServiceOrderWithEmails> {
    return request<ServiceOrderWithEmails>(`/os/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  deleteOrder(id: number): Promise<void> {
    return request<void>(`/os/${id}`, { method: 'DELETE' });
  },

  addEmail(orderId: number, payload: EmailPayload): Promise<Email> {
    return request<Email>(`/os/${orderId}/emails`, { method: 'POST', body: JSON.stringify(payload) });
  },

  updateEmail(id: number, payload: EmailPayload): Promise<Email> {
    return request<Email>(`/emails/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  deleteEmail(id: number): Promise<void> {
    return request<void>(`/emails/${id}`, { method: 'DELETE' });
  },
};
