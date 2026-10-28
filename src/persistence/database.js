const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

function abrirBanco(
  filename = process.env.DB_PATH || resolve(__dirname, '../../data/quadrafacil.sqlite')
) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS migracoes (versao INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS estabelecimentos (id TEXT PRIMARY KEY, dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS gestores (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, estabelecimento_id TEXT REFERENCES estabelecimentos(id), dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS quadras (id TEXT PRIMARY KEY, estabelecimento_id TEXT NOT NULL REFERENCES estabelecimentos(id), dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS eventos (id TEXT PRIMARY KEY, quadra_id TEXT NOT NULL REFERENCES quadras(id), dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS regras (id TEXT PRIMARY KEY, quadra_id TEXT NOT NULL REFERENCES quadras(id), dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS mensalistas (id TEXT PRIMARY KEY, quadra_id TEXT NOT NULL REFERENCES quadras(id), dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pagamentos (id TEXT PRIMARY KEY, reserva_id TEXT UNIQUE NOT NULL REFERENCES eventos(id), dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ocupacoes (quadra_id TEXT REFERENCES quadras(id), data TEXT NOT NULL, minuto INTEGER NOT NULL, origem_id TEXT NOT NULL, PRIMARY KEY(quadra_id,data,minuto));
    CREATE TABLE IF NOT EXISTS metadados (chave TEXT PRIMARY KEY, dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS interesses (chave TEXT PRIMARY KEY, dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS suporte (id TEXT PRIMARY KEY, dados TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS checkouts (chave TEXT PRIMARY KEY, pedido TEXT NOT NULL, resposta TEXT NOT NULL);
    INSERT OR IGNORE INTO migracoes VALUES(1);
    INSERT OR IGNORE INTO migracoes VALUES(2);`);
  return db;
}
function transacao(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
module.exports = { abrirBanco, transacao };
