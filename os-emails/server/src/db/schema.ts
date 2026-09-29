/**
 * Estrutura das tabelas.
 *
 * Entidade OS   -> tabela "os"
 * Entidade EMAIL -> tabela "emails" (uma OS possui vários e-mails)
 *
 * Observação: o campo "obra" já foi chamado de "tag" em versões anteriores.
 * A migração (db/migrations.ts) renomeia a coluna sem perder dados.
 */

export const sqliteSchema = `
CREATE TABLE IF NOT EXISTS os (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_os   TEXT NOT NULL,
  cliente     TEXT NOT NULL,
  obra        TEXT NOT NULL,
  observacao  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emails (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  os_id       INTEGER NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  nome        TEXT,
  email       TEXT NOT NULL,
  fornecedor  TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emails_os_id  ON emails (os_id);
CREATE INDEX IF NOT EXISTS idx_os_numero_os  ON os (numero_os);
CREATE INDEX IF NOT EXISTS idx_os_cliente    ON os (cliente);
CREATE INDEX IF NOT EXISTS idx_os_obra       ON os (obra);
CREATE INDEX IF NOT EXISTS idx_emails_fornecedor ON emails (fornecedor);
`;

export const postgresSchema = `
CREATE TABLE IF NOT EXISTS os (
  id          SERIAL PRIMARY KEY,
  numero_os   TEXT NOT NULL,
  cliente     TEXT NOT NULL,
  obra        TEXT NOT NULL,
  observacao  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
  id          SERIAL PRIMARY KEY,
  os_id       INTEGER NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  nome        TEXT,
  email       TEXT NOT NULL,
  fornecedor  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_os_id  ON emails (os_id);
CREATE INDEX IF NOT EXISTS idx_os_numero_os  ON os (numero_os);
CREATE INDEX IF NOT EXISTS idx_os_cliente    ON os (cliente);
CREATE INDEX IF NOT EXISTS idx_os_obra       ON os (obra);
CREATE INDEX IF NOT EXISTS idx_emails_fornecedor ON emails (fornecedor);
`;
