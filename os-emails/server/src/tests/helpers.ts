import fs from 'node:fs';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../app.js';
import { createSqliteDb, type Db } from '../db/driver.js';
import { Repository } from '../repository.js';

export interface ApiResponse<T> {
  status: number;
  data: T;
  /** Cookie de sessão devolvido no login (quando houver). */
  cookie?: string;
}

export interface TestContext {
  baseUrl: string;
  db: Db;
  /** Chamada à API. Passe o cookie de sessão para acessar rotas protegidas. */
  api: <T = any>(method: string, url: string, body?: unknown, cookie?: string) => Promise<ApiResponse<T>>;
  /** Faz login e devolve o cookie de sessão (ou null se falhar). */
  login: (username: string, password: string) => Promise<string | null>;
  close: () => Promise<void>;
}

/** Sobe um servidor de teste (SQLite temporário) para exercitar a API de verdade. */
export async function startTestServer(prefix = 'os-emails-test-'): Promise<TestContext> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const db = createSqliteDb(path.join(workDir, 'test.sqlite'));
  await db.init();

  const app = createApp({ repo: new Repository(db), driver: 'sqlite', webDistPath: null });
  const server: Server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  const api = async <T = any>(
    method: string,
    url: string,
    body?: unknown,
    cookie?: string,
  ): Promise<ApiResponse<T> & { cookie?: string }> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;

    const response = await fetch(`${baseUrl}${url}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const setCookieHeader = response.headers.get('set-cookie');
    const text = await response.text();
    const data = text ? (JSON.parse(text) as T) : (undefined as unknown as T);

    return {
      status: response.status,
      data,
      cookie: setCookieHeader ? setCookieHeader.split(';')[0] ?? undefined : undefined,
    };
  };

  const login = async (username: string, password: string): Promise<string | null> => {
    const response = await api('POST', '/api/auth/login', { username, password });
    return response.status === 200 ? response.cookie ?? null : null;
  };

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
    fs.rmSync(workDir, { recursive: true, force: true });
  };

  return { baseUrl, db, api, login, close };
}
