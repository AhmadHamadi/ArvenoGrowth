// Shared helpers for local development: .env loading and the embedded Postgres.
// Nothing here runs on Vercel.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, '.data');
export const LOCAL_PORT = Number(process.env.LOCAL_DB_PORT || 54329);
export const LOCAL_URL = `postgres://arveno:arveno@127.0.0.1:${LOCAL_PORT}/arveno`;
export const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');

/** Load .env.local then .env without overriding variables already set. */
export function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[m[1]] = value;
    }
  }
}

/** A stable per-machine session secret for local sign-in. */
export function localSessionSecret() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, 'session-secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
}

/** Start (and on first run, create) the embedded local Postgres. Returns a stop() function. */
export async function startLocalPostgres({ log = console.log } = {}) {
  // Reuse a local Postgres that another terminal already started.
  const { default: pgLib } = await import('pg');
  const probe = new pgLib.Client({ connectionString: LOCAL_URL, connectionTimeoutMillis: 1500 });
  try {
    await probe.connect();
    await probe.end();
    log(`Using the local Postgres already running on port ${LOCAL_PORT}.`);
    return { url: LOCAL_URL, stop: async () => {} };
  } catch {
    await probe.end().catch(() => {});
  }
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const databaseDir = path.join(DATA_DIR, 'postgres');
  const fresh = !fs.existsSync(path.join(databaseDir, 'PG_VERSION'));
  const pg = new EmbeddedPostgres({
    databaseDir, user: 'arveno', password: 'arveno', port: LOCAL_PORT, persistent: true,
    onLog: () => {}, onError: (message) => { if (message) log(`[postgres] ${String(message).trim()}`); }
  });
  if (fresh) {
    log('Creating local Postgres in .data/postgres (first run only)…');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    await pg.initialise();
  }
  await pg.start();
  if (fresh) await pg.createDatabase('arveno');
  return { url: LOCAL_URL, stop: () => pg.stop() };
}
