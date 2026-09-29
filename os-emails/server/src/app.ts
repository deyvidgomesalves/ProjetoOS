import fs from 'node:fs';
import path from 'node:path';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { Repository } from './repository.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createApiRouter } from './routes/osRoutes.js';
import type { DriverName } from './config.js';

export interface AppOptions {
  repo: Repository;
  driver: DriverName;
  /** Pasta do build do site (web/dist). Se existir, o site é servido pela própria API. */
  webDistPath?: string | null;
  /** Permite que outro domínio (ex.: Vercel) consuma a API. */
  corsOrigin?: string | null;
}

/** Cria a aplicação Express (API + site estático em produção). */
export function createApp(options: AppOptions): Express {
  const app = express();

  app.disable('x-powered-by');
  // Necessário para cookies seguros funcionarem atrás de proxy (Render, etc.).
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '512kb' }));

  if (options.corsOrigin) {
    const allowed = options.corsOrigin === '*' ? '*' : options.corsOrigin;
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Access-Control-Allow-Origin', allowed);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (allowed !== '*') res.setHeader('Access-Control-Allow-Credentials', 'true');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', driver: options.driver, time: new Date().toISOString() });
  });

  // Login/logout ficam fora da exigência de sessão.
  app.use('/api/auth', createAuthRouter());

  app.use('/api', createApiRouter(options.repo));

  // Qualquer rota /api desconhecida responde em JSON.
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });

  const distPath = options.webDistPath ?? null;
  const indexFile = distPath ? path.join(distPath, 'index.html') : null;
  const hasBuild = Boolean(indexFile && fs.existsSync(indexFile));

  if (distPath && indexFile && hasBuild) {
    // Arquivos com hash (js/css) podem ser cacheados por bastante tempo.
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));

    // O index.html é lido uma única vez e servido como fallback de SPA
    // (qualquer rota que não seja /api entrega a aplicação React).
    const indexHtml = fs.readFileSync(indexFile);

    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(indexHtml);
    });
  } else {
    app.use((_req: Request, res: Response) => {
      res.status(404).json({
        error: 'Site não encontrado. Rode "npm run build" na raiz do projeto para gerar o build do site.',
      });
    });
  }

  // Tratamento de erros.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status =
      typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
        ? error.status
        : 500;

    if (status === 400 || (typeof error === 'object' && error !== null && (error as { type?: string }).type === 'entity.parse.failed')) {
      res.status(400).json({ error: 'Requisição inválida.' });
      return;
    }

    console.error('[api] erro inesperado:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return app;
}
