import { Router } from 'express';
import { authenticate, createLoginThrottle, createSessionToken } from '../auth.js';
import { config } from '../config.js';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../middleware/auth.js';

const throttle = createLoginThrottle();

/** Rotas de login/logout (montadas em /api/auth). */
export function createAuthRouter(): Router {
  const router = Router();

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    const body = (req.body ?? {}) as { username?: unknown; password?: unknown };
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const throttleKey = `${req.ip ?? 'sem-ip'}|${username.toLowerCase()}`;

    if (!username || !password) {
      res.status(400).json({ error: 'Informe usuário e senha.' });
      return;
    }

    if (throttle.isBlocked(throttleKey)) {
      res.status(429).json({ error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' });
      return;
    }

    const user = authenticate(username, password);
    if (!user) {
      throttle.registerFailure(throttleKey);
      res.status(401).json({ error: 'Usuário ou senha inválidos.' });
      return;
    }

    throttle.reset(throttleKey);
    const ttlSeconds = config.auth.sessionTtlHours * 60 * 60;
    setSessionCookie(req, res, createSessionToken(user, ttlSeconds));
    res.json({ user });
  });

  // POST /api/auth/logout
  router.post('/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.status(204).end();
  });

  // GET /api/auth/me -> quem está logado (usado pela interface ao abrir a página)
  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
