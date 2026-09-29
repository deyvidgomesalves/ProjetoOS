import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** Diretório do arquivo atual (src/ em dev, dist/ em produção). */
const currentDir = path.dirname(fileURLToPath(import.meta.url));

/** Raiz do monorepo (pasta os-emails). */
export const rootDir = path.resolve(currentDir, '..', '..');

/**
 * Lê um arquivo .env simples (KEY=VALUE) e injeta em process.env.
 * Variáveis já definidas no ambiente têm prioridade.
 */
export function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

// Carrega .env da pasta de execução e da raiz do projeto.
loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(rootDir, '.env'));

export type DriverName = 'sqlite' | 'postgres';

function resolveDriver(): DriverName {
  const declared = (process.env.DB_DRIVER ?? '').trim().toLowerCase();
  if (declared === 'sqlite' || declared === 'postgres') return declared;
  if (declared && declared !== 'auto') {
    throw new Error(`DB_DRIVER inválido: "${declared}". Use "sqlite" ou "postgres".`);
  }
  return process.env.DATABASE_URL && process.env.DATABASE_URL.trim() ? 'postgres' : 'sqlite';
}

function resolveFile(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

/**
 * Segredo usado para assinar o cookie de sessão.
 * Em produção, defina SESSION_SECRET no .env (assim as sessões sobrevivem ao restart).
 */
function resolveSessionSecret(): string {
  const fromEnv = (process.env.SESSION_SECRET ?? '').trim();
  if (fromEnv) return fromEnv;
  return randomBytes(32).toString('hex');
}

const databaseUrl = (process.env.DATABASE_URL ?? '').trim();
const driver = resolveDriver();

const sslFlag = (process.env.PGSSL ?? '').trim().toLowerCase();
const wantsSsl =
  sslFlag === 'require' ||
  sslFlag === 'true' ||
  sslFlag === '1' ||
  /sslmode=require/.test(databaseUrl) ||
  /supabase\.(com|co)|neon\.tech|render\.com|railway\.app/i.test(databaseUrl);

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  port: Number(process.env.PORT ?? 3000),
  driver,
  sqliteFile: resolveFile(process.env.DB_FILE, path.join(rootDir, 'server', 'data', 'os.sqlite')),
  databaseUrl,
  pgSsl: wantsSsl,
  corsOrigin: (process.env.CORS_ORIGIN ?? '').trim(),
  webDistPath: path.join(rootDir, 'web', 'dist'),

  // --- Login (dois usuários fixos: administrador e consulta) ---
  auth: {
    sessionSecret: resolveSessionSecret(),
    sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
    usingDefaultSecret: !(process.env.SESSION_SECRET ?? '').trim(),
    admin: {
      username: (process.env.ADMIN_USER ?? 'admin').trim(),
      name: (process.env.ADMIN_NAME ?? 'Administrador').trim(),
      password: process.env.ADMIN_PASSWORD ?? 'admin2004',
      /** Se informado, tem prioridade sobre ADMIN_PASSWORD. */
      passwordHash: process.env.ADMIN_PASSWORD_HASH ?? '',
    },
    user: {
      username: (process.env.USER_USER ?? 'usuario').trim(),
      name: (process.env.USER_NAME ?? 'Usuário').trim(),
      password: process.env.USER_PASSWORD ?? '123456',
      /** Se informado, tem prioridade sobre USER_PASSWORD. */
      passwordHash: process.env.USER_PASSWORD_HASH ?? '',
    },
  },
};
