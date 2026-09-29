import { config } from '../config.js';
import { createDb } from '../db/driver.js';
import { Repository } from '../repository.js';

/** Apaga todas as OS e e-mails (mantém a estrutura do banco). Uso: npm run db:clear */
async function main(): Promise<void> {
  const db = await createDb({
    driver: config.driver,
    sqliteFile: config.sqliteFile,
    databaseUrl: config.databaseUrl,
    pgSsl: config.pgSsl,
  });

  const repo = new Repository(db);
  const before = await repo.count();
  await repo.clearAll();
  const after = await repo.count();

  console.log(`[db:clear] OS removidas: ${before}. Total agora: ${after}.`);
  await db.close();
}

main().catch((error) => {
  console.error('[db:clear] Erro:', error);
  process.exit(1);
});
