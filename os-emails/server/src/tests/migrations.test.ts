import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, describe, it } from 'node:test';
import { createSqliteDb } from '../db/driver.js';
import { FORNECEDOR_NAO_INFORMADO } from '../db/migrations.js';
import { Repository } from '../repository.js';

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os-emails-migracao-'));
const dbFile = path.join(workDir, 'antigo.sqlite');

/** Cria um banco no formato ANTIGO: OS com "tag" e e-mails sem "fornecedor". */
function createLegacyDatabase(): void {
  const legacy = new DatabaseSync(dbFile);
  legacy.exec(`
    CREATE TABLE os (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_os TEXT NOT NULL,
      cliente TEXT NOT NULL,
      tag TEXT NOT NULL,
      observacao TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      os_id INTEGER NOT NULL REFERENCES os(id) ON DELETE CASCADE,
      nome TEXT,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();
  legacy
    .prepare('INSERT INTO os (numero_os, cliente, tag, observacao, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('55555', 'Cliente Antigo', 'KPC81BG001', 'OS criada antes da troca de TAG por Obra', now, now);
  legacy
    .prepare('INSERT INTO emails (os_id, nome, email, created_at) VALUES (?, ?, ?, ?)')
    .run(1, 'Carlos', 'carlos@antigo.com', now);
  legacy
    .prepare('INSERT INTO emails (os_id, nome, email, created_at) VALUES (?, ?, ?, ?)')
    .run(1, null, 'compras@antigo.com', now);

  legacy.close();
}

after(() => {
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('Migração de banco antigo (tag -> obra / fornecedor)', () => {
  it('renomeia a coluna tag para obra e cria o fornecedor sem perder dados', async () => {
    createLegacyDatabase();

    const db = createSqliteDb(dbFile);
    await db.init(); // aqui a migração roda

    const repo = new Repository(db);

    // A OS antiga continua lá, agora com o campo "obra".
    const lista = await repo.list();
    assert.equal(lista.length, 1);
    assert.equal(lista[0]?.numero_os, '55555');
    assert.equal(lista[0]?.obra, 'KPC81BG001');
    assert.equal(lista[0]?.email_count, 2);

    // Os e-mails antigos aparecem como "Não informado" e podem ser editados depois.
    const detalhe = await repo.findById(lista[0]!.id);
    assert.equal(detalhe?.emails.length, 2);
    assert.deepEqual(
      detalhe?.emails.map((email) => email.fornecedor),
      [FORNECEDOR_NAO_INFORMADO, FORNECEDOR_NAO_INFORMADO],
    );

    // A pesquisa pela obra migrada funciona.
    const porObra = await repo.list('kpc81bg001');
    assert.equal(porObra.length, 1);

    // E o e-mail antigo pode ser editado já com um fornecedor de verdade.
    const atualizado = await repo.updateEmail(detalhe!.emails[0]!.id, {
      nome: 'Carlos',
      email: 'carlos@antigo.com',
      fornecedor: 'Priner',
    });
    assert.equal(atualizado?.fornecedor, 'Priner');

    const fornecedores = await repo.listFornecedores();
    assert.deepEqual(fornecedores, [FORNECEDOR_NAO_INFORMADO, 'Priner']);

    await db.close();
  });

  it('pode ser executada novamente sem efeitos colaterais', async () => {
    const db = createSqliteDb(dbFile);
    await db.init(); // banco já migrado: não deve quebrar nem duplicar nada

    const repo = new Repository(db);
    const lista = await repo.list();
    assert.equal(lista.length, 1);
    assert.equal(lista[0]?.obra, 'KPC81BG001');

    // O fornecedor ajustado no teste anterior continua salvo.
    const fornecedores = await repo.listFornecedores();
    assert.deepEqual(fornecedores, [FORNECEDOR_NAO_INFORMADO, 'Priner']);

    await db.close();
  });
});
