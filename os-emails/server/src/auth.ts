import crypto from 'node:crypto';
import { config } from './config.js';

export type Role = 'admin' | 'user';

export interface SessionUser {
  username: string;
  name: string;
  role: Role;
}

interface AuthUser extends SessionUser {
  /** Senha guardada apenas como hash (scrypt). */
  passwordHash: string;
}

export const SESSION_COOKIE = 'os_emails_session';
const SCRYPT_KEY_LENGTH = 64;

/* -------------------------------------------------------------- Senhas --- */

/** Gera o hash de uma senha no formato "scrypt$salt$hash". */
export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

/** Compara a senha informada com o hash salvo (comparação em tempo constante). */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [scheme, salt, expected] = storedHash.split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;

  const derived = crypto.scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (expectedBuffer.length !== derived.length) return false;

  return crypto.timingSafeEqual(derived, expectedBuffer);
}

/* ------------------------------------------------------------- Usuários --- */

interface AuthSettings {
  username: string;
  name: string;
  password: string;
  passwordHash: string;
  role: Role;
}

/** Usuários do sistema (dois perfis fixos). */
function buildUsers(): AuthUser[] {
  const settings: AuthSettings[] = [
    {
      username: config.auth.admin.username,
      name: config.auth.admin.name,
      password: config.auth.admin.password,
      passwordHash: config.auth.admin.passwordHash,
      role: 'admin',
    },
    {
      username: config.auth.user.username,
      name: config.auth.user.name,
      password: config.auth.user.password,
      passwordHash: config.auth.user.passwordHash,
      role: 'user',
    },
  ];

  // A senha em texto puro só é usada aqui no start para gerar o hash.
  return settings.map((item) => ({
    username: item.username,
    name: item.name,
    role: item.role,
    passwordHash: item.passwordHash.trim() ? item.passwordHash.trim() : hashPassword(item.password),
  }));
}

const users = buildUsers();

export function findUser(username: string): SessionUser | null {
  const target = (username ?? '').trim().toLowerCase();
  const found = users.find((item) => item.username.toLowerCase() === target);
  return found ? { username: found.username, name: found.name, role: found.role } : null;
}

/** Valida login e senha. Devolve o usuário ou null. */
export function authenticate(username: string, password: string): SessionUser | null {
  const target = (username ?? '').trim().toLowerCase();
  const found = users.find((item) => item.username.toLowerCase() === target);

  if (!found) {
    // Gasta o mesmo tempo de verificação quando o usuário não existe.
    verifyPassword(password ?? '', hashPassword('usuario-invalido'));
    return null;
  }

  if (!verifyPassword(password ?? '', found.passwordHash)) return null;
  return { username: found.username, name: found.name, role: found.role };
}

/* --------------------------------------------------------------- Sessão --- */

interface SessionPayload {
  u: string;
  r: Role;
  e: number;
}

/** Cria um token de sessão assinado (HMAC-SHA256) — não precisa guardar em banco. */
export function createSessionToken(user: SessionUser, ttlSeconds: number): string {
  const payload: SessionPayload = {
    u: user.username,
    r: user.role,
    e: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', config.auth.sessionSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

/** Valida a assinatura e a validade do token de sessão. */
export function verifySessionToken(token: string): SessionUser | null {
  const [body, signature] = (token ?? '').split('.');
  if (!body || !signature) return null;

  const expected = crypto.createHmac('sha256', config.auth.sessionSecret).update(body).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (!payload.u || !payload.e || (payload.r !== 'admin' && payload.r !== 'user')) return null;
    if (payload.e * 1000 <= Date.now()) return null;

    const user = findUser(payload.u);
    if (!user || user.role !== payload.r) return null;
    return user;
  } catch {
    return null;
  }
}

/* ---------------------------------------- Limite de tentativas de login --- */

export interface LoginThrottle {
  isBlocked(key: string): boolean;
  registerFailure(key: string): void;
  reset(key: string): void;
}

/**
 * Proteção simples contra tentativas repetidas de senha (em memória).
 * Depois de N falhas o login daquele usuário fica bloqueado por alguns minutos.
 */
export function createLoginThrottle(maxAttempts = 8, windowMs = 5 * 60 * 1000): LoginThrottle {
  const attempts = new Map<string, { count: number; startedAt: number }>();

  return {
    isBlocked(key: string): boolean {
      const entry = attempts.get(key);
      if (!entry) return false;
      if (Date.now() - entry.startedAt > windowMs) {
        attempts.delete(key);
        return false;
      }
      return entry.count >= maxAttempts;
    },

    registerFailure(key: string): void {
      const entry = attempts.get(key);
      if (!entry || Date.now() - entry.startedAt > windowMs) {
        attempts.set(key, { count: 1, startedAt: Date.now() });
        return;
      }
      entry.count += 1;
    },

    reset(key: string): void {
      attempts.delete(key);
    },
  };
}
