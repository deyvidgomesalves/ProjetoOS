import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { authenticate, createLoginThrottle, createSessionToken, hashPassword, verifyPassword, verifySessionToken } from '../auth.js';
import { startTestServer, type TestContext } from './helpers.js';

let ctx: TestContext;

before(async () => {
  ctx = await startTestServer('os-emails-auth-');
});

after(async () => {
  await ctx.close();
});

describe('Senhas (hash scrypt)', () => {
  it('gera hash diferente do texto puro e valida a senha correta', () => {
    const hash = hashPassword('admin2004');
    assert.ok(hash.startsWith('scrypt$'));
    assert.ok(!hash.includes('admin2004'));
    assert.equal(verifyPassword('admin2004', hash), true);
    assert.equal(verifyPassword('admin2005', hash), false);
  });

  it('usa sal diferente a cada chamada', () => {
    assert.notEqual(hashPassword('123456'), hashPassword('123456'));
  });
});

describe('Token de sessão', () => {
  it('valida um token legítimo', () => {
    const user = authenticate('admin', 'admin2004');
    assert.ok(user);
    const token = createSessionToken(user!, 3600);
    assert.deepEqual(verifySessionToken(token), user);
  });

  it('recusa token com assinatura alterada', () => {
    const user = authenticate('usuario', '123456');
    assert.ok(user);
    const token = createSessionToken(user!, 3600);
    const [body] = token.split('.');
    assert.equal(verifySessionToken(`${body}.assinatura-falsa`), null);
    assert.equal(verifySessionToken('token-invalido'), null);
    assert.equal(verifySessionToken(''), null);
  });

  it('recusa token expirado', () => {
    const user = authenticate('admin', 'admin2004');
    const token = createSessionToken(user!, -10);
    assert.equal(verifySessionToken(token), null);
  });
});

describe('Limite de tentativas de login', () => {
  it('bloqueia depois de várias falhas', () => {
    const throttle = createLoginThrottle(3, 60_000);
    assert.equal(throttle.isBlocked('a'), false);
    throttle.registerFailure('a');
    throttle.registerFailure('a');
    assert.equal(throttle.isBlocked('a'), false);
    throttle.registerFailure('a');
    assert.equal(throttle.isBlocked('a'), true);
    throttle.reset('a');
    assert.equal(throttle.isBlocked('a'), false);
  });
});

describe('Login pela API', () => {
  it('autentica o administrador e devolve o perfil', async () => {
    const response = await ctx.api<{ user: { username: string; role: string; name: string } }>(
      'POST',
      '/api/auth/login',
      { username: 'admin', password: 'admin2004' },
    );

    assert.equal(response.status, 200);
    assert.equal(response.data.user.username, 'admin');
    assert.equal(response.data.user.role, 'admin');
    assert.ok(response.cookie, 'deve devolver o cookie de sessão');
  });

  it('autentica o usuário de consulta', async () => {
    const response = await ctx.api<{ user: { role: string } }>('POST', '/api/auth/login', {
      username: 'usuario',
      password: '123456',
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.user.role, 'user');
  });

  it('recusa senha errada e usuário inexistente', async () => {
    const senhaErrada = await ctx.api('POST', '/api/auth/login', { username: 'admin', password: 'errada' });
    assert.equal(senhaErrada.status, 401);

    const inexistente = await ctx.api('POST', '/api/auth/login', { username: 'visitante', password: '123456' });
    assert.equal(inexistente.status, 401);

    const vazio = await ctx.api('POST', '/api/auth/login', { username: '', password: '' });
    assert.equal(vazio.status, 400);
  });

  it('devolve o usuário logado em /api/auth/me', async () => {
    const cookie = await ctx.login('usuario', '123456');
    assert.ok(cookie);

    const me = await ctx.api<{ user: { username: string } }>('GET', '/api/auth/me', undefined, cookie ?? '');
    assert.equal(me.status, 200);
    assert.equal(me.data.user.username, 'usuario');

    const semCookie = await ctx.api('GET', '/api/auth/me');
    assert.equal(semCookie.status, 401);
  });

  it('encerra a sessão no logout', async () => {
    const cookie = await ctx.login('usuario', '123456');
    assert.ok(cookie);

    const logout = await ctx.api('POST', '/api/auth/logout', undefined, cookie ?? '');
    assert.equal(logout.status, 204);
  });
});

describe('Proteção das rotas', () => {
  it('exige login para pesquisar/visualizar OS', async () => {
    assert.equal((await ctx.api('GET', '/api/os')).status, 401);
    assert.equal((await ctx.api('GET', '/api/os/1')).status, 401);
  });

  it('exige login para as operações administrativas', async () => {
    assert.equal((await ctx.api('POST', '/api/os', { numero_os: '1', cliente: 'c', obra: 'o' })).status, 401);
    assert.equal((await ctx.api('PUT', '/api/os/1', { numero_os: '1', cliente: 'c', obra: 'o' })).status, 401);
    assert.equal((await ctx.api('DELETE', '/api/os/1')).status, 401);
    assert.equal(
      (await ctx.api('POST', '/api/os/1/emails', { email: 'a@b.com', fornecedor: 'Priner' })).status,
      401,
    );
    assert.equal((await ctx.api('PUT', '/api/emails/1', { email: 'a@b.com', fornecedor: 'Priner' })).status, 401);
    assert.equal((await ctx.api('DELETE', '/api/emails/1')).status, 401);
  });
});


describe('Perfil USUÁRIO (somente consulta)', () => {
  it('consegue pesquisar, abrir a OS e ler os e-mails', async () => {
    const adminCookie = await ctx.login('admin', 'admin2004');
    assert.ok(adminCookie);
    const userCookie = await ctx.login('usuario', '123456');
    assert.ok(userCookie);

    // O administrador cadastra a OS...
    const created = await ctx.api<{ id: number; emails: { id: number }[] }>(
      'POST',
      '/api/os',
      {
        numero_os: '90001',
        cliente: 'Cliente Consulta',
        obra: 'Obra Consulta',
        emails: [
          { nome: 'Carlos', email: 'carlos@consulta.com', fornecedor: 'Priner' },
          { nome: 'Maria', email: 'maria@consulta.com', fornecedor: 'Empresa 2' },
        ],
      },
      adminCookie ?? '',
    );
    assert.equal(created.status, 201);

    // ...e o usuário de consulta visualiza (inclusive os fornecedores, para poder filtrar).
    const lista = await ctx.api<{ total: number; items: { numero_os: string; obra: string }[] }>(
      'GET',
      '/api/os?q=Obra Consulta',
      undefined,
      userCookie ?? '',
    );
    assert.equal(lista.status, 200);
    assert.equal(lista.data.total, 1);
    assert.equal(lista.data.items[0]?.obra, 'Obra Consulta');

    const porFornecedor = await ctx.api<{ total: number }>('GET', '/api/os?q=Priner', undefined, userCookie ?? '');
    assert.equal(porFornecedor.status, 200);
    assert.equal(porFornecedor.data.total, 1);

    const detalhe = await ctx.api<{ numero_os: string; emails: { email: string; fornecedor: string }[] }>(
      'GET',
      `/api/os/${created.data.id}`,
      undefined,
      userCookie ?? '',
    );
    assert.equal(detalhe.status, 200);
    assert.equal(detalhe.data.numero_os, '90001');
    assert.deepEqual(
      detalhe.data.emails.map((email) => email.email),
      ['carlos@consulta.com', 'maria@consulta.com'],
    );
    assert.deepEqual(
      detalhe.data.emails.map((email) => email.fornecedor),
      ['Priner', 'Empresa 2'],
    );
  });

  it('não consegue criar, editar ou excluir OS nem mexer nos e-mails', async () => {
    const adminCookie = await ctx.login('admin', 'admin2004');
    const userCookie = await ctx.login('usuario', '123456');
    assert.ok(adminCookie && userCookie);

    const os = await ctx.api<{ id: number; emails: { id: number }[] }>(
      'POST',
      '/api/os',
      {
        numero_os: '90002',
        cliente: 'Cliente Protegido',
        obra: 'Obra Protegida',
        emails: [{ email: 'x@protegido.com', fornecedor: 'Priner' }],
      },
      adminCookie ?? '',
    );
    assert.equal(os.status, 201);
    const osId = os.data.id;
    const emailId = os.data.emails[0]!.id;

    const proibido = async (method: string, url: string, body?: unknown) =>
      ctx.api(method, url, body, userCookie ?? '');

    assert.equal((await proibido('POST', '/api/os', { numero_os: '9', cliente: 'c', obra: 'o' })).status, 403);
    assert.equal(
      (await proibido('PUT', `/api/os/${osId}`, { numero_os: '9', cliente: 'c', obra: 'o' })).status,
      403,
    );
    assert.equal((await proibido('DELETE', `/api/os/${osId}`)).status, 403);
    assert.equal(
      (await proibido('POST', `/api/os/${osId}/emails`, { email: 'novo@protegido.com', fornecedor: 'Priner' })).status,
      403,
    );
    assert.equal(
      (await proibido('PUT', `/api/emails/${emailId}`, { email: 'alterado@protegido.com', fornecedor: 'Empresa 2' }))
        .status,
      403,
    );
    assert.equal((await proibido('DELETE', `/api/emails/${emailId}`)).status, 403);

    // Nada foi alterado no banco.
    const depois = await ctx.api<{ numero_os: string; emails: { fornecedor: string }[] }>(
      'GET',
      `/api/os/${osId}`,
      undefined,
      adminCookie ?? '',
    );
    assert.equal(depois.data.numero_os, '90002');
    assert.equal(depois.data.emails.length, 1);
    assert.equal(depois.data.emails[0]?.fornecedor, 'Priner');
  });

  it('o administrador continua com acesso total', async () => {
    const adminCookie = await ctx.login('admin', 'admin2004');
    assert.ok(adminCookie);

    const created = await ctx.api<{ id: number; emails: { id: number }[] }>(
      'POST',
      '/api/os',
      {
        numero_os: '90003',
        cliente: 'Cliente Admin',
        obra: 'Obra Admin',
        emails: [{ email: 'a@admin.com', fornecedor: 'Priner' }],
      },
      adminCookie ?? '',
    );
    assert.equal(created.status, 201);

    const updated = await ctx.api<{ cliente: string; emails: { id: number }[] }>(
      'PUT',
      `/api/os/${created.data.id}`,
      {
        numero_os: '90003',
        cliente: 'Cliente Admin Editado',
        obra: 'Obra Admin',
        emails: [{ email: 'b@admin.com', fornecedor: 'Empresa 2' }],
      },
      adminCookie ?? '',
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.data.cliente, 'Cliente Admin Editado');

    const added = await ctx.api(
      'POST',
      `/api/os/${created.data.id}/emails`,
      { nome: 'Extra', email: 'extra@admin.com', fornecedor: 'Priner' },
      adminCookie ?? '',
    );
    assert.equal(added.status, 201);

    // O e-mail que sobrou depois da edição pode ser excluído pelo administrador.
    const removedEmail = await ctx.api(
      'DELETE',
      `/api/emails/${updated.data.emails[0]!.id}`,
      undefined,
      adminCookie ?? '',
    );
    assert.equal(removedEmail.status, 204);

    const removedOs = await ctx.api('DELETE', `/api/os/${created.data.id}`, undefined, adminCookie ?? '');
    assert.equal(removedOs.status, 204);
  });
});


describe('Proteção contra tentativas repetidas', () => {
  it('bloqueia temporariamente depois de várias senhas erradas', async () => {
    let ultimoStatus = 0;

    for (let tentativa = 0; tentativa < 10; tentativa += 1) {
      const response = await ctx.api('POST', '/api/auth/login', { username: 'intruso', password: 'chute' });
      ultimoStatus = response.status;
    }

    assert.equal(ultimoStatus, 429, 'depois de várias falhas o login deve ser bloqueado');
  });
});
