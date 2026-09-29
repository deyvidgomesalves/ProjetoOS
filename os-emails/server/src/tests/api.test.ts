import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { startTestServer, type TestContext } from './helpers.js';

let ctx: TestContext;
let adminCookie = '';

/** As operações de escrita exigem o perfil administrador (as rotas são protegidas). */
const api = <T = any>(method: string, url: string, body?: unknown) => ctx.api<T>(method, url, body, adminCookie);

before(async () => {
  ctx = await startTestServer('os-emails-api-');
  const cookie = await ctx.login('admin', 'admin2004');
  assert.ok(cookie, 'o login do administrador deve funcionar');
  adminCookie = cookie ?? '';
});

after(async () => {
  await ctx.close();
});

let createdOsId = 0;
let carlosEmailId = 0;
let mariaEmailId = 0;

describe('API de OS e e-mails', () => {
  it('responde ao health check', async () => {
    const { status, data } = await api<{ status: string; driver: string }>('GET', '/api/health');
    assert.equal(status, 200);
    assert.equal(data.status, 'ok');
    assert.equal(data.driver, 'sqlite');
  });

  it('cria uma OS com obra e vários e-mails (inclusive sem nome)', async () => {
    const { status, data } = await api('POST', '/api/os', {
      numero_os: '12345',
      cliente: 'Empresa ABC',
      obra: 'Obra XPTO',
      observacao: 'Aguardando peça',
      emails: [
        { nome: 'Carlos', email: 'Carlos@EmpresaABC.com.br', fornecedor: 'Priner' },
        { nome: 'Maria', email: 'maria@empresaabc.com.br', fornecedor: 'Empresa 2' },
        { email: 'compras@empresaabc.com.br', fornecedor: 'Empresa 3' },
        { nome: 'Vazio', email: '   ' },
      ],
    });

    assert.equal(status, 201);
    assert.ok(data.id > 0);
    assert.equal(data.numero_os, '12345');
    assert.equal(data.obra, 'Obra XPTO');
    assert.equal(data.observacao, 'Aguardando peça');
    assert.equal(data.emails.length, 3, 'linha em branco deve ser ignorada');
    assert.equal(data.emails[0].email, 'carlos@empresaabc.com.br', 'e-mail deve ser normalizado');
    assert.equal(data.emails[2].nome, null, 'nome é opcional');
    assert.deepEqual(
      data.emails.map((email: any) => email.fornecedor),
      ['Priner', 'Empresa 2', 'Empresa 3'],
    );

    createdOsId = data.id;
    carlosEmailId = data.emails[0].id;
    mariaEmailId = data.emails[1].id;
  });

  it('lista as OS com a quantidade de e-mails', async () => {
    const { status, data } = await api<{ items: any[]; total: number }>('GET', '/api/os');
    assert.equal(status, 200);
    assert.equal(data.total, 1);
    assert.equal(data.items[0].numero_os, '12345');
    assert.equal(data.items[0].cliente, 'Empresa ABC');
    assert.equal(data.items[0].obra, 'Obra XPTO');
    assert.equal(data.items[0].email_count, 3);
  });

  it('pesquisa por número da OS, cliente, obra e fornecedor (sem diferenciar maiúsculas)', async () => {
    const porNumero = await api<{ total: number }>('GET', '/api/os?q=12345');
    assert.equal(porNumero.data.total, 1);

    const porCliente = await api<{ total: number }>('GET', '/api/os?q=empresa abc');
    assert.equal(porCliente.data.total, 1);

    const porObra = await api<{ total: number }>('GET', '/api/os?q=Obra XPTO');
    assert.equal(porObra.data.total, 1);

    const obraParcial = await api<{ total: number }>('GET', '/api/os?q=xpto');
    assert.equal(obraParcial.data.total, 1);

    const porFornecedor = await api<{ total: number }>('GET', '/api/os?q=priner');
    assert.equal(porFornecedor.data.total, 1);

    const semResultado = await api<{ total: number; items: unknown[] }>('GET', '/api/os?q=nao-existe');
    assert.equal(semResultado.data.total, 0);
    assert.deepEqual(semResultado.data.items, []);
  });

  it('devolve os detalhes da OS com os e-mails e seus fornecedores', async () => {
    const { status, data } = await api('GET', `/api/os/${createdOsId}`);
    assert.equal(status, 200);
    assert.equal(data.obra, 'Obra XPTO');
    assert.equal(data.emails.length, 3);
    assert.deepEqual(
      data.emails.map((email: any) => email.email),
      ['carlos@empresaabc.com.br', 'maria@empresaabc.com.br', 'compras@empresaabc.com.br'],
    );
    assert.deepEqual(
      data.emails.map((email: any) => email.fornecedor),
      ['Priner', 'Empresa 2', 'Empresa 3'],
    );
  });

  it('lista os fornecedores já cadastrados', async () => {
    const { status, data } = await api<{ items: string[] }>('GET', '/api/fornecedores');
    assert.equal(status, 200);
    assert.deepEqual(data.items, ['Empresa 2', 'Empresa 3', 'Priner']);
  });

  it('adiciona um e-mail em uma OS existente', async () => {
    const { status, data } = await api('POST', `/api/os/${createdOsId}/emails`, {
      nome: 'João',
      email: 'joao@empresaabc.com.br',
      fornecedor: 'Priner',
    });
    assert.equal(status, 201);
    assert.equal(data.nome, 'João');
    assert.equal(data.fornecedor, 'Priner');

    const detail = await api<{ emails: any[] }>('GET', `/api/os/${createdOsId}`);
    assert.equal(detail.data.emails.length, 4);
  });

  it('edita um e-mail individual (inclusive o fornecedor)', async () => {
    const { status, data } = await api('PUT', `/api/emails/${mariaEmailId}`, {
      nome: 'Maria Silva',
      email: 'maria.silva@empresaabc.com.br',
      fornecedor: 'Empresa 4',
    });
    assert.equal(status, 200);
    assert.equal(data.nome, 'Maria Silva');
    assert.equal(data.email, 'maria.silva@empresaabc.com.br');
    assert.equal(data.fornecedor, 'Empresa 4');
  });

  it('remove um e-mail individual', async () => {
    const { status } = await api('DELETE', `/api/emails/${carlosEmailId}`);
    assert.equal(status, 204);

    const detail = await api<{ emails: any[] }>('GET', `/api/os/${createdOsId}`);
    assert.equal(detail.data.emails.length, 3);
  });

  it('edita a OS e sincroniza os e-mails (mantém, edita, adiciona e remove)', async () => {
    const detail = await api<{ emails: any[] }>('GET', `/api/os/${createdOsId}`);
    const emailMantido = detail.data.emails[0];

    const { status, data } = await api('PUT', `/api/os/${createdOsId}`, {
      numero_os: '12345-A',
      cliente: 'Empresa ABC Ltda',
      obra: 'Obra XPTO - Revisão',
      observacao: 'Observação atualizada',
      emails: [
        { id: emailMantido.id, nome: 'Maria Editada', email: emailMantido.email, fornecedor: 'Priner' },
        { nome: 'Novo Contato', email: 'novo@empresaabc.com.br', fornecedor: 'Empresa 5' },
      ],
    });

    assert.equal(status, 200);
    assert.equal(data.numero_os, '12345-A');
    assert.equal(data.cliente, 'Empresa ABC Ltda');
    assert.equal(data.obra, 'Obra XPTO - Revisão');
    assert.equal(data.observacao, 'Observação atualizada');
    assert.equal(data.emails.length, 2, 'e-mails não enviados devem ser removidos');
    assert.equal(data.emails[0].id, emailMantido.id, 'e-mail mantido preserva o id');
    assert.equal(data.emails[0].nome, 'Maria Editada');
    assert.equal(data.emails[0].fornecedor, 'Priner');
    assert.equal(data.emails[1].nome, 'Novo Contato');
    assert.equal(data.emails[1].fornecedor, 'Empresa 5');
  });

  it('recusa dados inválidos com status 400', async () => {
    const semCampos = await api('POST', '/api/os', { emails: [{ email: 'teste@teste.com' }] });
    assert.equal(semCampos.status, 400);
    assert.ok(Array.isArray(semCampos.data.details));
    assert.ok(semCampos.data.details.length >= 3);

    const emailInvalido = await api('POST', '/api/os', {
      numero_os: '999',
      cliente: 'Teste',
      obra: 'Obra 1',
      emails: [{ email: 'sem-arroba', fornecedor: 'Priner' }],
    });
    assert.equal(emailInvalido.status, 400);

    const duplicado = await api('POST', '/api/os', {
      numero_os: '998',
      cliente: 'Teste',
      obra: 'Obra 2',
      emails: [
        { email: 'a@b.com', fornecedor: 'Priner' },
        { email: 'A@B.com', fornecedor: 'Empresa 2' },
      ],
    });
    assert.equal(duplicado.status, 400);

    // Fornecedor é obrigatório.
    const semFornecedor = await api('POST', '/api/os', {
      numero_os: '997',
      cliente: 'Teste',
      obra: 'Obra 3',
      emails: [{ nome: 'Carlos', email: 'carlos@fornecedor.com' }],
    });
    assert.equal(semFornecedor.status, 400);
    assert.ok(
      (semFornecedor.data.details as string[]).some((item) => item.toLowerCase().includes('fornecedor')),
      'a mensagem deve apontar o fornecedor obrigatório',
    );

    const fornecedorEmBranco = await api('POST', '/api/os/999999/emails', {
      email: 'a@b.com',
      fornecedor: '   ',
    });
    assert.equal(fornecedorEmBranco.status, 400);
  });

  it('devolve 404 para OS e e-mails inexistentes', async () => {
    assert.equal((await api('GET', '/api/os/999999')).status, 404);
    assert.equal(
      (await api('PUT', '/api/os/999999', { numero_os: '1', cliente: 'c', obra: 'o' })).status,
      404,
    );
    assert.equal((await api('DELETE', '/api/os/999999')).status, 404);
    assert.equal((await api('POST', '/api/os/999999/emails', { email: 'a@b.com', fornecedor: 'Priner' })).status, 404);
    assert.equal((await api('PUT', '/api/emails/999999', { email: 'a@b.com', fornecedor: 'Priner' })).status, 404);
    assert.equal((await api('DELETE', '/api/emails/999999')).status, 404);
    assert.equal((await api('GET', '/api/rota-inexistente')).status, 404);
  });

  it('exclui a OS e os e-mails vinculados em cascata', async () => {
    const { data: osComEmails } = await api<{ emails: any[] }>('GET', `/api/os/${createdOsId}`);
    const emailId = osComEmails.emails[0].id;

    const removed = await api('DELETE', `/api/os/${createdOsId}`);
    assert.equal(removed.status, 204);
    assert.equal((await api('GET', `/api/os/${createdOsId}`)).status, 404);

    const lista = await api<{ total: number }>('GET', '/api/os');
    assert.equal(lista.data.total, 0);

    const emailOrfao = await api('GET', `/api/os/${createdOsId}`);
    assert.equal(emailOrfao.status, 404);

    const emailsRestantes = await ctx.db.query<{ total: number | string }>(
      'SELECT COUNT(*) AS total FROM emails WHERE id = ?',
      [emailId],
    );
    assert.equal(Number(emailsRestantes[0]?.total ?? 0), 0, 'e-mails devem ser apagados junto com a OS');
  });
});
