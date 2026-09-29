import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import type { Repository } from '../repository.js';
import { validateEmailPayload, validateOSPayload } from '../validation.js';

function parseId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function invalid(response: import('express').Response, details: string[]): void {
  response.status(400).json({ error: 'Dados inválidos.', details });
}

/** Rotas da API (montadas em /api). */
export function createApiRouter(repo: Repository): Router {
  const router = Router();

  // Pesquisar/visualizar exige login; criar/editar/excluir exige o perfil administrador.
  router.use(requireAuth);

  // GET /api/os?q=texto -> lista de OS (com a quantidade de e-mails)
  router.get('/os', async (req, res) => {
    const term = typeof req.query.q === 'string' ? req.query.q : '';
    const items = await repo.list(term);
    res.json({ items, total: items.length, query: term.trim() });
  });

  // GET /api/fornecedores -> fornecedores já cadastrados (sugestões no cadastro e no filtro)
  router.get('/fornecedores', async (_req, res) => {
    const items = await repo.listFornecedores();
    res.json({ items });
  });

  // POST /api/os -> cria a OS com seus e-mails (somente administrador)
  router.post('/os', requireAdmin, async (req, res) => {
    const validation = validateOSPayload(req.body);
    if (!validation.ok) {
      invalid(res, validation.errors);
      return;
    }
    const created = await repo.create(validation.data);
    res.status(201).json(created);
  });

  // GET /api/os/:id -> detalhes da OS + e-mails
  router.get('/os/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      invalid(res, ['Identificador de OS inválido.']);
      return;
    }
    const found = await repo.findById(id);
    if (!found) {
      res.status(404).json({ error: 'OS não encontrada.' });
      return;
    }
    res.json(found);
  });

  // PUT /api/os/:id -> edita a OS e sincroniza os e-mails (somente administrador)
  router.put('/os/:id', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      invalid(res, ['Identificador de OS inválido.']);
      return;
    }
    const validation = validateOSPayload(req.body);
    if (!validation.ok) {
      invalid(res, validation.errors);
      return;
    }
    const updated = await repo.update(id, validation.data);
    if (!updated) {
      res.status(404).json({ error: 'OS não encontrada.' });
      return;
    }
    res.json(updated);
  });

  // DELETE /api/os/:id -> exclui a OS (somente administrador)
  router.delete('/os/:id', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      invalid(res, ['Identificador de OS inválido.']);
      return;
    }
    const removed = await repo.remove(id);
    if (!removed) {
      res.status(404).json({ error: 'OS não encontrada.' });
      return;
    }
    res.status(204).end();
  });

  // POST /api/os/:id/emails -> adiciona um e-mail à OS (somente administrador)
  router.post('/os/:id/emails', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      invalid(res, ['Identificador de OS inválido.']);
      return;
    }
    const validation = validateEmailPayload(req.body);
    if (!validation.ok) {
      invalid(res, validation.errors);
      return;
    }
    const email = await repo.addEmail(id, validation.data);
    if (!email) {
      res.status(404).json({ error: 'OS não encontrada.' });
      return;
    }
    res.status(201).json(email);
  });

  // PUT /api/emails/:id -> edita um e-mail (somente administrador)
  router.put('/emails/:id', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      invalid(res, ['Identificador de e-mail inválido.']);
      return;
    }
    const validation = validateEmailPayload(req.body);
    if (!validation.ok) {
      invalid(res, validation.errors);
      return;
    }
    const email = await repo.updateEmail(id, validation.data);
    if (!email) {
      res.status(404).json({ error: 'E-mail não encontrado.' });
      return;
    }
    res.json(email);
  });

  // DELETE /api/emails/:id -> remove um e-mail (somente administrador)
  router.delete('/emails/:id', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) {
      invalid(res, ['Identificador de e-mail inválido.']);
      return;
    }
    const removed = await repo.deleteEmail(id);
    if (!removed) {
      res.status(404).json({ error: 'E-mail não encontrado.' });
      return;
    }
    res.status(204).end();
  });

  return router;
}
