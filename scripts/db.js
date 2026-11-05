#!/usr/bin/env node
// Portal database CLI.
//
//   npm run db -- migrate                 apply db/migrations to DATABASE_URL (or the local DB)
//   npm run db -- admin you@domain.com    create/reset a portal login (prompts for the password)
//   npm run db -- import-supabase         copy every CRM row + signed PDF from Supabase into Postgres
//   npm run db -- status                  show which migrations ran and row counts
//   npm run db -- local                   run the local Postgres in this terminal (Ctrl+C stops it)
//
// Without DATABASE_URL the commands use the embedded local Postgres in .data/postgres.
import readline from 'node:readline';
import { closePool, migrate, pgRequest, putFile, query } from '../lib/db.js';
import { setAdminPassword } from '../lib/portal-auth.js';
import { LOCAL_URL, MIGRATIONS_DIR, loadEnv, startLocalPostgres } from './local-db.js';

loadEnv();
const [command = 'help', ...args] = process.argv.slice(2);
const ORDER_KEY = { crm_stripe_events: 'event_id' };
const TABLES = ['clients', 'contracts', 'crm_payments', 'crm_stripe_events', 'crm_leads', 'crm_tasks', 'crm_reservation_deposits'];

function askHidden(prompt) {
  if (process.env.ADMIN_PASSWORD) return Promise.resolve(process.env.ADMIN_PASSWORD);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(prompt)) rl.output.write(s); };
    rl.question(prompt, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

async function withDatabase(fn) {
  let local;
  if (!process.env.DATABASE_URL) {
    local = await startLocalPostgres();
    process.env.DATABASE_URL = local.url;
  }
  try {
    return await fn();
  } finally {
    await closePool();
    await local?.stop();
  }
}

async function importSupabase() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (pull them with `vercel env pull`) to import.');
  const headers = { apikey: key, ...(process.env.SUPABASE_SECRET_KEY ? {} : { Authorization: `Bearer ${key}` }) };
  await migrate(MIGRATIONS_DIR, { log: (m) => console.log(`  ${m}`) });
  for (const table of TABLES) {
    let offset = 0, copied = 0;
    for (;;) {
      const res = await fetch(`${url}/rest/v1/${table}?select=*&order=${ORDER_KEY[table] || 'id'}.asc&limit=1000&offset=${offset}`, { headers });
      if (res.status === 404) { console.log(`  ${table}: not in Supabase, skipped`); break; }
      if (!res.ok) throw new Error(`${table}: Supabase returned ${res.status} ${(await res.text()).slice(0, 200)}`);
      const rows = await res.json();
      if (!rows.length) break;
      const inserted = await pgRequest(`${table}`, {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(rows)
      });
      copied += inserted.length;
      offset += rows.length;
      if (rows.length < 1000) break;
    }
    console.log(`  ${table}: ${copied} new rows`);
  }
  const { rows: withPdf } = await query("select id, signed_pdf_path from contracts where signed_pdf_path is not null");
  let files = 0;
  for (const row of withPdf) {
    const exists = await query('select 1 from crm_files where bucket = $1 and path = $2', ['signed-contracts', row.signed_pdf_path]);
    if (exists.rowCount) continue;
    const res = await fetch(`${url}/storage/v1/object/signed-contracts/${row.signed_pdf_path}`, { headers });
    if (!res.ok) { console.warn(`  ! signed PDF missing for contract ${row.id} (${res.status})`); continue; }
    await putFile('signed-contracts', row.signed_pdf_path, Buffer.from(await res.arrayBuffer()), 'application/pdf');
    files++;
  }
  console.log(`  signed PDFs: ${files} copied`);
  console.log('Done. Supabase sign-in passwords cannot be exported. Run `npm run db -- admin <email>` to set the portal login.');
}

async function status() {
  const { rows: ran } = await query('select name, applied_at from schema_migrations order by name').catch(() => ({ rows: [] }));
  console.log(`Migrations applied: ${ran.length}`);
  ran.slice(-3).forEach((r) => console.log(`  ${r.name}`));
  for (const table of [...TABLES, 'crm_files', 'crm_admin_users']) {
    const n = await query(`select count(*)::int as n from ${table}`).then((r) => r.rows[0].n).catch(() => 'missing');
    console.log(`  ${table.padEnd(26)} ${n}`);
  }
}

const commands = {
  migrate: () => withDatabase(async () => {
    const ran = await migrate(MIGRATIONS_DIR, { log: (m) => console.log(`  ${m}`) });
    console.log(ran.length ? `Applied ${ran.length} migration(s).` : 'Database is up to date.');
  }),
  admin: () => withDatabase(async () => {
    const email = args[0];
    if (!email) throw new Error('Usage: npm run db -- admin you@domain.com');
    await migrate(MIGRATIONS_DIR);
    const password = await askHidden(`New portal password for ${email} (12+ characters): `);
    const saved = await setAdminPassword(email, password);
    const allowed = (process.env.CONTRACT_ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim());
    console.log(`Saved login for ${saved}.`);
    if (!allowed.includes(saved)) console.log(`The local dev server allows this login automatically. For a hosted database, add ${saved} to CONTRACT_ADMIN_EMAILS in Vercel.`);
  }),
  'import-supabase': () => withDatabase(importSupabase),
  status: () => withDatabase(status),
  local: async () => {
    const local = await startLocalPostgres();
    process.env.DATABASE_URL = local.url;
    await migrate(MIGRATIONS_DIR, { log: (m) => console.log(`  ${m}`) });
    await closePool();
    console.log(`Local Postgres is running.\n  DATABASE_URL=${LOCAL_URL}\nCtrl+C to stop.`);
    const stop = async () => { await local.stop(); process.exit(0); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    await new Promise(() => {});
  },
  help: async () => {
    console.log('Usage: npm run db -- <migrate | admin <email> | import-supabase | status | local>');
  }
};

const run = commands[command] || commands.help;
run().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
