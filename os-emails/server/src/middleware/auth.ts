import type { NextFunction, Request, Response } from 'express';
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from '../auth.js';
import { config } from '../config.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Usuário da sessão (preenchido por requireAuth). */
      user?: SessionUser;
    }
  }
}

/** Lê os cookies do cabeçalho da requisição (sem dependências externas). */
export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) continue;
    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

/** Devolve o usuário logado (ou null) a partir do cookie de sessão. */
export function readSession(req: Request): SessionUser | null {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  return verifySessionToken(token);
}

/** Garante que existe um usuário logado. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = readSession(req);

  if (!user) {
    res.status(401).json({ error: 'Faça login para continuar.' });
    return;
  }

  req.user = user;
  next();
}

/** Garante que o usuário logado é o administrador (operações de escrita). */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user ?? readSession(req);

  if (!user) {
    res.status(401).json({ error: 'Faça login para continuar.' });
    return;
  }

  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Seu usuário tem acesso somente para consulta.' });
    return;
  }

  req.user = user;
  next();
}

/** O cookie é "secure" em https (ou em produção) e "none" quando site e API ficam em domínios diferentes. */
function cookieOptions(req: Request): { secure: boolean; sameSite: 'lax' | 'none' } {
  const crossSite = Boolean(config.corsOrigin);
  const forwarded = req.headers['x-forwarded-proto'];
  const isHttps =
    req.secure || (typeof forwarded === 'string' && forwarded.split(',')[0]?.trim() === 'https') || config.isProduction;

  if (crossSite) return { secure: true, sameSite: 'none' };
  return { secure: isHttps, sameSite: 'lax' };
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const { secure, sameSite } = cookieOptions(req);

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
    maxAge: config.auth.sessionTtlHours * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  const { secure, sameSite } = cookieOptions(req);
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite, secure, path: '/' });
}
