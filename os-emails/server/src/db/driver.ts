import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { runMigrations } from './migrations.js';
import { postgresSchema, sqliteSchema } from './schema.js';
import type { DriverName } from '../config.js';

export type SqlParam = string | number | bigint | boolean | null | undefined | Date;
export type SqlParams = readonly SqlParam[];

export interface RunResult {
  changes: number;
  lastInsertId?: number;
}

export interface Db {
  readonly driver: DriverName;
  /** Executa um SELECT e devolve todas as linhas. */
  query<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T[]>;
  /** Executa um SELECT e devolve a primeira linha (ou undefined). */
  get<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T | undefined>;
  /** Executa INSERT/UPDATE/DELETE. */
  run(sql: string, params?: SqlParams): Promise<RunResult>;
  /** Executa uma função dentro de uma transação. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  /** Cria as tabelas/índices caso ainda não existam. */
  init(): Promise<void>;
  /** Fecha a conexão. */
  close(): Promise<void>;
}

/**
 * Converte os marcadores "?" usados na aplicação para os marcadores "$1, $2..."
 * do Postgres. Trechos entre aspas simples são ignorados.
 */
export function toPgSql(sql: string): string {
  let index = 0;
  let inString = false;
  let result = '';

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];

    if (char === "'") {
      if (inString && sql[i + 1] === "'") {
        result += "''";
        i += 1;
        continue;
      }
      inString = !inString;
      result += char;
      continue;
    }

    if (char === '?' && !inString) {
      index += 1;
      result += `$${index}`;
      continue;
    }

    result += char;
  }

  return result;
}

/** Ajusta os valores para o formato aceito pelos drivers. */
export function normalizeParams(params: SqlParams = []): (string | number | null)[] {
  return params.map((param) => {
    if (param === undefined || param === null) return null;
    if (typeof param === 'boolean') return param ? 1 : 0;
    if (param instanceof Date) return param.toISOString();
    if (typeof param === 'bigint') return Number(param);
    return param;
  });
}

/** Converte datas do Postgres (Date) para texto ISO, igual ao SQLite. */
export function toIsoString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}


type SqliteStatement = ReturnType<DatabaseSync['prepare']>;

export function createSqliteDb(file: string): Db {
  let database: DatabaseSync | null = null;
  const statements = new Map<string, SqliteStatement>();

  const getDatabase = (): DatabaseSync => {
    if (!database) throw new Error('Banco SQLite não inicializado. Chame init() primeiro.');
    return database;
  };

  const prepare = (sql: string): SqliteStatement => {
    const connection = getDatabase();
    let statement = statements.get(sql);
    if (!statement) {
      statement = connection.prepare(sql);
      statements.set(sql, statement);
    }
    return statement;
  };

  const db: Db = {
    driver: 'sqlite',

    async query<T>(sql: string, params: SqlParams = []): Promise<T[]> {
      const rows = prepare(sql).all(...normalizeParams(params));
      return rows as unknown as T[];
    },

    async get<T>(sql: string, params: SqlParams = []): Promise<T | undefined> {
      const row = prepare(sql).get(...normalizeParams(params));
      return row as unknown as T | undefined;
    },

    async run(sql: string, params: SqlParams = []): Promise<RunResult> {
      const result = prepare(sql).run(...normalizeParams(params));
      const lastInsertId =
        typeof result.lastInsertRowid === 'bigint'
          ? Number(result.lastInsertRowid)
          : result.lastInsertRowid;
      return { changes: Number(result.changes ?? 0), lastInsertId: Number(lastInsertId) };
    },

    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      await db.run('BEGIN');
      try {
        const result = await fn(db);
        await db.run('COMMIT');
        return result;
      } catch (error) {
        try {
          await db.run('ROLLBACK');
        } catch {
          /* ignora falha no rollback */
        }
        throw error;
      }
    },

    async init(): Promise<void> {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      database = new DatabaseSync(file);
      database.exec('PRAGMA journal_mode = WAL;');
      database.exec('PRAGMA foreign_keys = ON;');
      // 1º ajusta bancos antigos (tag -> obra, fornecedor) e depois cria o que faltar.
      await runMigrations(db);
      database.exec(sqliteSchema);
    },

    async close(): Promise<void> {
      statements.clear();
      database?.close();
      database = null;
    },
  };

  return db;
}


interface PgExecutor {
  query: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>;
}

export function createPostgresDb(connectionString: string, ssl: boolean): Db {
  const pool = new pg.Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
  });

  const wrap = (
    executor: PgExecutor,
    transactionFn: Db['transaction'],
    initFn: () => Promise<void>,
    closeFn: () => Promise<void>,
  ): Db => ({
    driver: 'postgres',

    async query<T>(sql: string, params: SqlParams = []): Promise<T[]> {
      const result = await executor.query(toPgSql(sql), normalizeParams(params));
      return result.rows as unknown as T[];
    },

    async get<T>(sql: string, params: SqlParams = []): Promise<T | undefined> {
      const result = await executor.query(toPgSql(sql), normalizeParams(params));
      return result.rows[0] as unknown as T | undefined;
    },

    async run(sql: string, params: SqlParams = []): Promise<RunResult> {
      const result = await executor.query(toPgSql(sql), normalizeParams(params));
      return { changes: result.rowCount ?? 0 };
    },

    transaction: transactionFn,
    init: initFn,
    close: closeFn,
  });

  const db = wrap(
    { query: (sql, params) => pool.query(sql, params) },
    async (fn) => {
      const client = await pool.connect();
      const txDb = wrap(
        { query: (sql, params) => client.query(sql, params) },
        () => Promise.reject(new Error('Transações aninhadas não são suportadas.')),
        async () => undefined,
        async () => undefined,
      );

      try {
        await client.query('BEGIN');
        const result = await fn(txDb);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* ignora falha no rollback */
        }
        throw error;
      } finally {
        client.release();
      }
    },
    async () => {
      // 1º ajusta bancos antigos (tag -> obra, fornecedor) e depois cria o que faltar.
      await runMigrations(db);
      await pool.query(postgresSchema);
    },
    async () => {
      await pool.end();
    },
  );

  return db;
}

export interface CreateDbOptions {
  driver: DriverName;
  sqliteFile: string;
  databaseUrl: string;
  pgSsl: boolean;
}

/** Cria o banco conforme a configuração (SQLite por padrão, Postgres quando configurado). */
export async function createDb(options: CreateDbOptions): Promise<Db> {
  if (options.driver === 'postgres') {
    if (!options.databaseUrl) {
      throw new Error('DB_DRIVER=postgres exige a variável DATABASE_URL.');
    }
    const db = createPostgresDb(options.databaseUrl, options.pgSsl);
    await db.init();
    return db;
  }

  const db = createSqliteDb(options.sqliteFile);
  await db.init();
  return db;
}
