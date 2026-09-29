import { config } from './config.js';
import { createDb } from './db/driver.js';
import { Repository } from './repository.js';

/**
 * Insere algumas OS de exemplo para testar a interface.
 * Uso: npm run seed            (não faz nada se já existirem OS)
 *      npm run seed -- --force (insere novamente)
 */
const force = process.argv.includes('--force');

const samples = [
  {
    numero_os: '12345',
    cliente: 'Empresa ABC',
    obra: 'Obra XPTO',
    observacao: 'Enviar relatório de manutenção após o término.',
    emails: [
      { nome: 'Carlos', email: 'carlos@empresaabc.com.br', fornecedor: 'Priner' },
      { nome: 'João', email: 'joao@empresaabc.com.br', fornecedor: 'Priner' },
      { nome: null, email: 'compras@empresaabc.com.br', fornecedor: 'Empresa 2' },
    ],
  },
  {
    numero_os: '12346',
    cliente: 'Indústria Silva',
    obra: 'Obra Silva Norte',
    observacao: null,
    emails: [
      { nome: 'Maria', email: 'maria@silva.ind.br', fornecedor: 'Empresa 2' },
      { nome: 'Financeiro', email: 'financeiro@silva.ind.br', fornecedor: 'Empresa 3' },
    ],
  },
  {
    numero_os: '23451',
    cliente: 'Metalúrgica Central',
    obra: 'Obra Central Sul',
    observacao: 'Aguardando liberação de acesso.',
    emails: [
      { nome: null, email: 'contato@metalurgicacentral.com', fornecedor: 'Priner' },
      { nome: 'Suprimentos', email: 'suprimentos@metalurgicacentral.com', fornecedor: 'Empresa 3' },
    ],
  },
];

async function main(): Promise<void> {
  const db = await createDb({
    driver: config.driver,
    sqliteFile: config.sqliteFile,
    databaseUrl: config.databaseUrl,
    pgSsl: config.pgSsl,
  });

  const repo = new Repository(db);
  const existing = await repo.count();

  if (existing > 0 && !force) {
    console.log(`[seed] O banco já possui ${existing} OS. Nada foi inserido (use --force para inserir mesmo assim).`);
    await db.close();
    return;
  }

  for (const sample of samples) {
    const created = await repo.create({ ...sample, emails: sample.emails.map((email) => ({ ...email })) });
    console.log(`[seed] OS ${created.numero_os} criada com ${created.emails.length} e-mail(s).`);
  }

  console.log(`[seed] Concluído. Total de OS: ${await repo.count()}`);
  await db.close();
}

main().catch(async (error) => {
  console.error('[seed] Erro:', error);
  process.exit(1);
});
