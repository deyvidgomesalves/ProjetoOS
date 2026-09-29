import type { Db } from './driver.js';

/** Valor usado nos e-mails antigos, cadastrados antes de existir o campo fornecedor. */
export const FORNECEDOR_NAO_INFORMADO = 'Não informado';

interface ColumnRow {
  name?: string;
  column_name?: string;
}

/** Colunas da tabela ou null quando a tabela ainda não existe. */
async function tableColumns(db: Db, table: string): Promise<string[] | null> {
  if (db.driver === 'sqlite') {
    const rows = await db.query<ColumnRow>(`PRAGMA table_info(${table})`);
    if (rows.length === 0) return null;
    return rows.map((row) => String(row.name ?? '').toLowerCase()).filter(Boolean);
  }

  const rows = await db.query<ColumnRow>(
    'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?',
    [table],
  );
  if (rows.length === 0) return null;
  return rows.map((row) => String(row.column_name ?? '').toLowerCase()).filter(Boolean);
}

/**
 * Ajusta bancos criados por versões anteriores:
 *  - renomeia a coluna "tag" da OS para "obra" (sem perder dados);
 *  - cria a coluna "fornecedor" nos e-mails e preenche os registros antigos
 *    com "Não informado" (podendo ser editados depois).
 *
 * Roda antes da criação das tabelas/índices e não faz nada quando o banco
 * já está atualizado (ou quando é um banco novo, ainda vazio).
 */
export async function runMigrations(db: Db): Promise<void> {
  const osColumns = await tableColumns(db, 'os');
  if (osColumns?.includes('tag') && !osColumns.includes('obra')) {
    await db.run('ALTER TABLE os RENAME COLUMN tag TO obra');
    console.log('[migração] coluna "tag" renomeada para "obra".');
  }

  const emailColumns = await tableColumns(db, 'emails');
  if (emailColumns && !emailColumns.includes('fornecedor')) {
    await db.run('ALTER TABLE emails ADD COLUMN fornecedor TEXT');
    console.log('[migração] coluna "fornecedor" criada na tabela de e-mails.');

    const affected = await db.run(
      'UPDATE emails SET fornecedor = ? WHERE fornecedor IS NULL OR TRIM(fornecedor) = ?',
      [FORNECEDOR_NAO_INFORMADO, ''],
    );
    if (affected.changes > 0) {
      console.log(`[migração] ${affected.changes} e-mail(s) antigos marcados como "${FORNECEDOR_NAO_INFORMADO}".`);
    }
  }
}
