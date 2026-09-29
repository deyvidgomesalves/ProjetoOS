import { FORNECEDOR_NAO_INFORMADO } from './db/migrations.js';
import { toIsoString, type Db } from './db/driver.js';
import type { EmailInput, OSInput } from './validation.js';

export interface Email {
  id: number;
  os_id: number;
  nome: string | null;
  email: string;
  fornecedor: string;
  created_at: string;
}

export interface ServiceOrder {
  id: number;
  numero_os: string;
  cliente: string;
  obra: string;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderWithEmails extends ServiceOrder {
  emails: Email[];
}

export interface ServiceOrderListItem extends ServiceOrder {
  email_count: number;
}

interface OsRow {
  id: number | string;
  numero_os: string;
  cliente: string;
  obra: string;
  observacao: string | null;
  created_at: unknown;
  updated_at: unknown;
}

interface EmailRow {
  id: number | string;
  os_id: number | string;
  nome: string | null;
  email: string;
  fornecedor: string | null;
  created_at: unknown;
}

const OS_COLUMNS = 'o.id, o.numero_os, o.cliente, o.obra, o.observacao, o.created_at, o.updated_at';

const EMAIL_COLUMNS = 'e.id, e.os_id, e.nome, e.email, e.fornecedor, e.created_at';

function mapOs(row: OsRow): ServiceOrder {
  return {
    id: Number(row.id),
    numero_os: row.numero_os,
    cliente: row.cliente,
    obra: row.obra,
    observacao: row.observacao ?? null,
    created_at: toIsoString(row.created_at) ?? '',
    updated_at: toIsoString(row.updated_at) ?? '',
  };
}

function mapEmail(row: EmailRow): Email {
  const fornecedor = (row.fornecedor ?? '').trim();
  return {
    id: Number(row.id),
    os_id: Number(row.os_id),
    nome: row.nome && row.nome.trim() ? row.nome : null,
    email: row.email,
    // E-mails cadastrados antes do campo existir aparecem como "Não informado"
    // e podem ser editados depois normalmente.
    fornecedor: fornecedor || FORNECEDOR_NAO_INFORMADO,
    created_at: toIsoString(row.created_at) ?? '',
  };
}

/** Acesso aos dados de OS e e-mails. Funciona igual no SQLite e no Postgres. */
export class Repository {
  constructor(private readonly db: Db) {}

  /** Lista as OS (mais recentes primeiro), filtrando por número da OS, cliente, obra ou fornecedor. */
  async list(search?: string): Promise<ServiceOrderListItem[]> {
    const term = (search ?? '').trim().toLowerCase();
    const params: string[] = [];
    let where = '';

    if (term) {
      where = `WHERE (
                 LOWER(o.numero_os) LIKE ?
              OR LOWER(o.cliente) LIKE ?
              OR LOWER(o.obra) LIKE ?
              OR EXISTS (
                   SELECT 1 FROM emails ef
                    WHERE ef.os_id = o.id
                      AND LOWER(COALESCE(ef.fornecedor, '')) LIKE ?
                 )
               )`;
      const like = `%${term}%`;
      params.push(like, like, like, like);
    }

    const rows = await this.db.query<OsRow & { email_count: number | string }>(
      `SELECT ${OS_COLUMNS},
              (SELECT COUNT(*) FROM emails e WHERE e.os_id = o.id) AS email_count
         FROM os o
         ${where}
        ORDER BY o.updated_at DESC, o.id DESC`,
      params,
    );

    return rows.map((row) => ({ ...mapOs(row), email_count: Number(row.email_count ?? 0) }));
  }

  async findById(id: number): Promise<ServiceOrderWithEmails | null> {
    const row = await this.db.get<OsRow>(`SELECT ${OS_COLUMNS} FROM os o WHERE o.id = ?`, [id]);
    if (!row) return null;

    const emails = await this.db.query<EmailRow>(
      `SELECT ${EMAIL_COLUMNS} FROM emails e WHERE e.os_id = ? ORDER BY e.id ASC`,
      [id],
    );

    return { ...mapOs(row), emails: emails.map(mapEmail) };
  }

  async count(): Promise<number> {
    const row = await this.db.get<{ total: number | string }>('SELECT COUNT(*) AS total FROM os');
    return Number(row?.total ?? 0);
  }

  async clearAll(): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.run('DELETE FROM emails');
      await tx.run('DELETE FROM os');
    });
  }

  async create(input: OSInput): Promise<ServiceOrderWithEmails> {
    const now = new Date().toISOString();

    const id = await this.db.transaction(async (tx) => {
      const inserted = await tx.query<{ id: number | string }>(
        `INSERT INTO os (numero_os, cliente, obra, observacao, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [input.numero_os, input.cliente, input.obra, input.observacao, now, now],
      );

      const osId = Number(inserted[0]?.id);
      if (!osId) throw new Error('Não foi possível obter o id da OS criada.');

      for (const email of input.emails) {
        await this.insertEmail(tx, osId, email.nome, email.email, email.fornecedor, now);
      }

      return osId;
    });

    const created = await this.findById(id);
    if (!created) throw new Error('Não foi possível carregar a OS criada.');
    return created;
  }

  /** Atualiza os dados da OS e sincroniza a lista de e-mails (adiciona, edita e remove). */
  async update(id: number, input: OSInput): Promise<ServiceOrderWithEmails | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();

    await this.db.transaction(async (tx) => {
      await tx.run(
        `UPDATE os SET numero_os = ?, cliente = ?, obra = ?, observacao = ?, updated_at = ? WHERE id = ?`,
        [input.numero_os, input.cliente, input.obra, input.observacao, now, id],
      );

      const keptIds = new Set(
        input.emails
          .map((email) => email.id)
          .filter((value): value is number => typeof value === 'number' && value > 0),
      );

      for (const email of existing.emails) {
        if (!keptIds.has(email.id)) {
          await tx.run('DELETE FROM emails WHERE id = ?', [email.id]);
        }
      }

      for (const email of input.emails) {
        const belongsToThisOs = email.id !== undefined && existing.emails.some((item) => item.id === email.id);
        if (belongsToThisOs) {
          await tx.run('UPDATE emails SET nome = ?, email = ?, fornecedor = ? WHERE id = ?', [
            email.nome,
            email.email,
            email.fornecedor,
            email.id,
          ]);
        } else {
          await this.insertEmail(tx, id, email.nome, email.email, email.fornecedor, now);
        }
      }
    });

    return this.findById(id);
  }

  /** Remove a OS (os e-mails vinculados são apagados em cascata). */
  async remove(id: number): Promise<boolean> {
    const result = await this.db.run('DELETE FROM os WHERE id = ?', [id]);
    return result.changes > 0;
  }

  /** Adiciona um e-mail a uma OS existente. Devolve null se a OS não existir. */
  async addEmail(osId: number, input: EmailInput): Promise<Email | null> {
    const os = await this.db.get<{ id: number }>('SELECT id FROM os WHERE id = ?', [osId]);
    if (!os) return null;

    const now = new Date().toISOString();
    const id = await this.insertEmail(this.db, osId, input.nome, input.email, input.fornecedor, now);
    return this.findEmailById(id);
  }

  async findEmailById(id: number): Promise<Email | null> {
    const row = await this.db.get<EmailRow>(`SELECT ${EMAIL_COLUMNS} FROM emails e WHERE e.id = ?`, [id]);
    return row ? mapEmail(row) : null;
  }

  /** Lista os fornecedores já usados (para sugerir no cadastro e alimentar o filtro). */
  async listFornecedores(): Promise<string[]> {
    const rows = await this.db.query<{ fornecedor: string | null }>(
      `SELECT DISTINCT fornecedor FROM emails WHERE fornecedor IS NOT NULL AND TRIM(fornecedor) <> '' ORDER BY LOWER(fornecedor)`,
    );
    return rows.map((row) => (row.fornecedor ?? '').trim()).filter(Boolean);
  }

  async updateEmail(emailId: number, input: EmailInput): Promise<Email | null> {
    const result = await this.db.run('UPDATE emails SET nome = ?, email = ?, fornecedor = ? WHERE id = ?', [
      input.nome,
      input.email,
      input.fornecedor,
      emailId,
    ]);
    if (result.changes === 0) {
      const existing = await this.findEmailById(emailId);
      if (!existing) return null;
    }
    return this.findEmailById(emailId);
  }

  async deleteEmail(emailId: number): Promise<boolean> {
    const result = await this.db.run('DELETE FROM emails WHERE id = ?', [emailId]);
    return result.changes > 0;
  }

  /** Insere um e-mail usando a conexão/transação informada. */
  private async insertEmail(
    db: Db,
    osId: number,
    nome: string | null,
    email: string,
    fornecedor: string,
    createdAt: string,
  ): Promise<number> {
    const inserted = await db.query<{ id: number | string }>(
      `INSERT INTO emails (os_id, nome, email, fornecedor, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [osId, nome, email, fornecedor, createdAt],
    );
    return Number(inserted[0]?.id);
  }
}

