-- ===========================================================================
-- Estrutura do banco para Postgres / Supabase
-- Execute este arquivo no "SQL Editor" do Supabase (ou em qualquer Postgres)
-- caso queira criar as tabelas manualmente. A API também cria sozinha na
-- primeira execução (CREATE TABLE IF NOT EXISTS).
--
-- Entidades:
--   os      -> Ordem de Serviço (numero_os, cliente, obra, observacao)
--   emails  -> e-mails do cliente (uma OS possui vários e-mails),
--              cada um com nome (opcional), e-mail e fornecedor (obrigatório)
--
-- Observação: bancos criados por versões anteriores são ajustados sozinhos
-- pelo servidor (a coluna "tag" vira "obra" e a coluna "fornecedor" é criada
-- na tabela de e-mails), sem perder dados.
-- ===========================================================================

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
  nome        TEXT,                -- opcional: pode ser NULL
  email       TEXT NOT NULL,
  fornecedor  TEXT,                -- obrigatório no cadastro (e-mails antigos: 'Não informado')
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_os_id       ON emails (os_id);
CREATE INDEX IF NOT EXISTS idx_os_numero_os       ON os (numero_os);
CREATE INDEX IF NOT EXISTS idx_os_cliente         ON os (cliente);
CREATE INDEX IF NOT EXISTS idx_os_obra            ON os (obra);
CREATE INDEX IF NOT EXISTS idx_emails_fornecedor  ON emails (fornecedor);
