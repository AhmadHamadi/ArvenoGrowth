#!/usr/bin/env node
// One-command local portal: Postgres + API functions + Vite site on http://localhost:3000
//
//   npm run dev:portal
//
// Uses DATABASE_URL when set; otherwise starts the embedded Postgres in .data/postgres.
// Mirrors Vercel's rewrites and its req/res helpers closely enough for the api/ handlers.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { closePool, migrate, query } from '../lib/db.js';
import { LOCAL_URL, MIGRATIONS_DIR, ROOT, loadEnv, localSessionSecret, startLocalPostgres } from './local-db.js';

loadEnv();
const PORT = Number(process.env.PORT || 3000);
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

const rewrites = (vercel.rewrites || []).map(({ source, destination }) => ({
  re: new RegExp(`^${source.split('(.*)').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.*)')}$`),
  destination
}));

function rewrite(url) {
  const [pathname, search = ''] = url.split('?');
  for (const r of rewrites) {
    const m = pathname.match(r.re);
    if (!m) continue;
    const dest = r.destination.replace(/\$(\d)/g, (_, i) => m[Number(i)] || '');
    const [destPath, destSearch = ''] = dest.split('?');
    const merged = new URLSearchParams(search);
    new URLSearchParams(destSearch).forEach((v, k) => merged.set(k, v));
    const qs = merged.toString();
    return destPath + (qs ? `?${qs}` : '');
  }
  return url;
}

function apiFile(pathname) {
  const rel = pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  if (rel.includes('..')) return null;
  for (const candidate of [`${rel}.js`, `${rel}/index.js`]) {
    const file = path.join(ROOT, 'api', candidate);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function handleApi(req, res, url) {
  const file = apiFile(url.pathname);
  if (!file) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Not found' })); return; }
  const mod = await import(`${pathToFileURL(file).href}?t=${fs.statSync(file).mtimeMs}`);
  req.query = Object.fromEntries(url.searchParams);
  if (mod.config?.api?.bodyParser !== false && !['GET', 'HEAD'].includes(req.method)) {
    const raw = await readBody(req);
    const type = String(req.headers['content-type'] || '');
    if (type.includes('application/json')) {
      try { req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {}; }
      catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }
    } else if (type.includes('application/x-www-form-urlencoded')) req.body = Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
    else req.body = raw.length ? raw.toString('utf8') : undefined;
  }
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return res; };
  res.send = (body) => {
    if (Buffer.isBuffer(body) || typeof body === 'string') res.end(body);
    else res.json(body);
    return res;
  };
  await mod.default(req, res);
}

async function main() {
  let local;
  if (!process.env.DATABASE_URL) {
    local = await startLocalPostgres();
    process.env.DATABASE_URL = local.url;
  }
  const isLocalDb = process.env.DATABASE_URL === LOCAL_URL;
  process.env.ADMIN_SESSION_SECRET ||= localSessionSecret();
  await migrate(MIGRATIONS_DIR, { log: (m) => console.log(`  ${m}`) });

  const admins = (await query('select email from crm_admin_users order by email')).rows.map((r) => r.email);
  // Local database only: every saved portal login is allowed, so first-run setup is one command.
  if (isLocalDb && !process.env.CONTRACT_ADMIN_EMAILS) process.env.CONTRACT_ADMIN_EMAILS = admins.join(',');

  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, appType: 'mpa', server: { middlewareMode: true, hmr: { port: PORT + 1 } } });

  const server = http.createServer(async (req, res) => {
    try {
      req.url = rewrite(req.url || '/');
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      vite.middlewares(req, res, () => { res.statusCode = 404; res.end('Not found'); });
    } catch (error) {
      console.error('[dev-server]', error);
      if (!res.headersSent) res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Local server error. See the terminal.' }));
    }
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n  Arveno Growth running locally`);
    console.log(`  Site    http://localhost:${PORT}/`);
    console.log(`  Portal  http://localhost:${PORT}/admin`);
    console.log(`  DB      ${isLocalDb ? `local Postgres (${LOCAL_URL})` : 'DATABASE_URL'}`);
    if (!admins.length) console.log(`\n  No portal login yet. In another terminal run:\n    npm run db -- admin you@yourdomain.com\n  then restart this server.`);
    console.log('');
  });

  const stop = async () => {
    server.close();
    await vite.close();
    await closePool();
    await local?.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
