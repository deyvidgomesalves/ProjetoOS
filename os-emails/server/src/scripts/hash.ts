import { hashPassword } from '../auth.js';

/**
 * Gera o hash (scrypt) de uma senha para colocar no .env.
 * Uso: npm run hash -- "minha senha"
 */
const password = process.argv.slice(2).join(' ').trim();

if (!password) {
  console.error('Uso: npm run hash -- "minha senha"');
  process.exit(1);
}

console.log(hashPassword(password));
