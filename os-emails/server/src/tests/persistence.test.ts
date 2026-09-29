import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { createSqliteDb, toPgSql } from '../db/driver.js';
import { Repository } from '../repository.js';
import { splitEmails, validateOSPayload } from '../validation.js';

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os-emails-persist-'));
const dbFile = path.join(workDir, 'persist.sqlite');

after(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('Persistência no banco de dados', () => {
  it('mantém os dados após fechar e reabrir o banco', async () => {
    // 1ª conexão: grava os dados.
    const first = createSqliteDb(dbFile);
    await first.init();

    const created = await new Repository(first).create({
      numero_os: '77777',
      cliente: 'Cliente Persistente',
      obra: 'Obra Persistente',
      observacao: 'Teste de persistência',
      emails: [
        { nome: 'Ana', email: 'ana@persist.com', fornecedor: 'Priner' },
        { nome: null, email: 'contato@persist.com', fornecedor: 'Empresa 2' },
      ],
    });

    assert.ok(created.id > 0);
    await first.close();

    // 2ª conexão: os dados precisam continuar lá (arquivo em disco, não na memória).
    const second = createSqliteDb(dbFile);
    await second.init();
    const repo = new Repository(second);

    const list = await repo.list('persist');
    assert.equal(list.length, 1);
    assert.equal(list[0]?.numero_os, '77777');
    assert.equal(list[0]?.obra, 'Obra Persistente');
    assert.equal(list[0]?.email_count, 2);

    const detail = await repo.findById(created.id);
    assert.equal(detail?.cliente, 'Cliente Persistente');
    assert.deepEqual(
      detail?.emails.map((email) => email.email),
      ['ana@persist.com', 'contato@persist.com'],
    );
    assert.deepEqual(
      detail?.emails.map((email) => email.fornecedor),
      ['Priner', 'Empresa 2'],
    );

    await second.close();
  });
});

describe('Conversão de SQL para Postgres', () => {
  it('troca os "?" pelos marcadores $1, $2...', () => {
    assert.equal(
      toPgSql('SELECT * FROM os WHERE id = ? AND tag = ?'),
      'SELECT * FROM os WHERE id = $1 AND tag = $2',
    );
  });

  it('ignora interrogações dentro de texto', () => {
    assert.equal(toPgSql("SELECT '?' AS x WHERE id = ?"), "SELECT '?' AS x WHERE id = $1");
  });

  it('mantém aspas escapadas', () => {
    assert.equal(toPgSql("UPDATE os SET cliente = 'Jo''s' WHERE id = ?"), "UPDATE os SET cliente = 'Jo''s' WHERE id = $1");
  });
});

describe('Validação dos dados', () => {
  it('separa e-mails colados de uma vez', () => {
    assert.deepEqual(splitEmails('a@x.com; b@y.com, c@z.com'), ['a@x.com', 'b@y.com', 'c@z.com']);
  });

  it('exige número da OS, cliente e obra', () => {
    const result = validateOSPayload({ observacao: 'só observação' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.errors.length, 3);
  });

  it('normaliza os campos e aceita e-mail sem nome', () => {
    const result = validateOSPayload({
      numero_os: '  123  ',
      cliente: ' Cliente X ',
      obra: ' Obra 9 ',
      emails: [{ email: '  User@Domain.COM ', fornecedor: '  Priner ' }],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.numero_os, '123');
    assert.equal(result.data.cliente, 'Cliente X');
    assert.equal(result.data.obra, 'Obra 9');
    assert.equal(result.data.observacao, null);
    assert.deepEqual(result.data.emails, [
      { id: undefined, nome: null, email: 'user@domain.com', fornecedor: 'Priner' },
    ]);
  });

  it('recusa e-mail inválido, duplicado e sem fornecedor', () => {
    const invalido = validateOSPayload({
      numero_os: '1',
      cliente: 'c',
      obra: 'o',
      emails: [{ email: 'invalido', fornecedor: 'Priner' }],
    });
    assert.equal(invalido.ok, false);

    const duplicado = validateOSPayload({
      numero_os: '1',
      cliente: 'c',
      obra: 'o',
      emails: [
        { email: 'a@b.com', fornecedor: 'Priner' },
        { email: 'A@b.com', fornecedor: 'Priner' },
      ],
    });
    assert.equal(duplicado.ok, false);

    const semFornecedor = validateOSPayload({
      numero_os: '1',
      cliente: 'c',
      obra: 'o',
      emails: [{ email: 'a@b.com' }],
    });
    assert.equal(semFornecedor.ok, false);
    if (!semFornecedor.ok) {
      assert.ok(semFornecedor.errors.some((item) => item.toLowerCase().includes('fornecedor')));
    }
  });
});
