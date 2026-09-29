import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { createDb } from './db/driver.js';
import { Repository } from './repository.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  const db = await createDb({
    driver: config.driver,
    sqliteFile: config.sqliteFile,
    databaseUrl: config.databaseUrl,
    pgSsl: config.pgSsl,
  });

  const repo = new Repository(db);

  const app = createApp({
    repo,
    driver: db.driver,
    webDistPath: config.webDistPath,
    corsOrigin: config.corsOrigin,
  });

  const hasBuild = fs.existsSync(path.join(config.webDistPath, 'index.html'));
  const dbLabel = db.driver === 'sqlite' ? `sqlite (${config.sqliteFile})` : 'postgres (DATABASE_URL)';

  const server = app.listen(config.port, () => {
    console.log('------------------------------------------------------------');
    console.log(' Sistema de OS e e-mails');
    console.log(` Servidor:      http://localhost:${config.port}`);
    if (hasBuild) {
      console.log(' Site:          servido pelo próprio servidor.');
    } else {
      console.log(' Site (dev):    http://localhost:5173  (rode "npm run dev")');
    }
    console.log(` Banco:         ${dbLabel}`);
    console.log(` Login:         usuário "${config.auth.admin.username}" (administrador) e "${config.auth.user.username}" (consulta)`);
    if (config.auth.usingDefaultSecret) {
      console.log(' Aviso:         defina SESSION_SECRET no .env para as sessões sobreviverem ao restart.');
    }
    console.log('------------------------------------------------------------');
  });

  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`\n[os-emails] Encerrando (${signal})...`);
    server.close(() => {
      void db.close().finally(() => process.exit(0));
    });
    // Garante o encerramento mesmo se houver conexões pendentes.
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[os-emails] Falha ao iniciar o servidor:', error);
  process.exit(1);
});
