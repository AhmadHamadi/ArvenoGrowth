// Plain Postgres backend for the portal.
//
// The API handlers were written against Supabase's REST syntax
// (`contracts?id=eq.X&select=a,b&order=created_at.desc`). This module runs the
// same requests directly against Postgres with parameterized SQL, so every
// handler works unchanged on a local database, Neon, Railway, or Supabase's own
// Postgres connection string. Only the subset of that syntax the portal uses is
// supported; anything else throws instead of guessing.
import pg from 'pg';

const { Pool, types } = pg;

// Match the JSON shapes the handlers already expect from Supabase REST.
types.setTypeParser(1184, (v) => (v === null ? null : new Date(v).toISOString())); // timestamptz
types.setTypeParser(1114, (v) => (v === null ? null : v.replace(' ', 'T'))); // timestamp
types.setTypeParser(1082, (v) => v); // date stays YYYY-MM-DD
types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric
types.setTypeParser(20, (v) => (v === null ? null : Number(v))); // int8

const IDENT = /^[a-z_][a-z0-9_]*$/;
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };

let pool;
let poolUrl;
export function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set.');
  if (!pool || poolUrl !== url) {
    pool?.end().catch(() => {});
    const ssl = process.env.DATABASE_SSL === 'no-verify' ? { rejectUnauthorized: false } : undefined;
    pool = new Pool({
      connectionString: url,
      ssl,
      max: Number(process.env.DATABASE_POOL_MAX || 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000
    });
    pool.on('error', (error) => console.error('[db] idle client error:', error?.message || error));
    poolUrl = url;
  }
  return pool;
}

export async function closePool() {
  const current = pool;
  pool = undefined;
  poolUrl = undefined;
  columnCache.clear();
  if (current) await current.end();
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

const ident = (name) => {
  if (!IDENT.test(name)) throw Object.assign(new Error(`Invalid database identifier "${name}".`), { status: 400 });
  return `"${name}"`;
};

// Column types, used to cast JSON values and reject unknown tables early.
const columnCache = new Map();
async function columns(table) {
  if (columnCache.has(table)) return columnCache.get(table);
  const { rows } = await query(
    `select column_name, data_type, udt_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
    [table]
  );
  if (!rows.length) throw new Error(`Database request failed (42P01). relation "public.${table}" does not exist`);
  const map = new Map(rows.map((r) => [r.column_name, { dataType: r.data_type, udt: r.udt_name }]));
  columnCache.set(table, map);
  return map;
}

function parsePath(path) {
  const [table, qs = ''] = String(path).split('?');
  ident(table);
  const params = [];
  for (const part of qs.split('&')) {
    if (!part) continue;
    const at = part.indexOf('=');
    if (at < 1) throw new Error(`Unsupported query parameter "${part}".`);
    params.push([decodeURIComponent(part.slice(0, at)), part.slice(at + 1)]);
  }
  return { table, params };
}

const escapeLike = (value) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`).replace(/\*/g, '%');

function parseInList(raw) {
  const inner = raw.trim();
  if (!inner.startsWith('(') || !inner.endsWith(')')) throw new Error(`Unsupported in() filter "${raw}".`);
  const out = [];
  let cur = '';
  let quoted = false;
  const body = inner.slice(1, -1);
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (body.length) out.push(cur);
  return out.map((v) => v.trim());
}

function buildWhere(filters, values) {
  const clauses = [];
  for (const [column, raw] of filters) {
    const col = ident(column);
    let rest = raw;
    let negate = false;
    if (rest.startsWith('not.')) { negate = true; rest = rest.slice(4); }
    const dot = rest.indexOf('.');
    if (dot < 1) throw new Error(`Unsupported filter "${column}=${raw}".`);
    const op = rest.slice(0, dot);
    const value = decodeURIComponent(rest.slice(dot + 1));
    let clause;
    if (OPS[op]) {
      values.push(value);
      clause = `${col} ${OPS[op]} $${values.length}`;
    } else if (op === 'in') {
      values.push(parseInList(value));
      clause = `${col}::text = any($${values.length}::text[])`;
    } else if (op === 'is') {
      const v = value.toLowerCase();
      if (!['null', 'true', 'false', 'unknown'].includes(v)) throw new Error(`Unsupported is filter "${value}".`);
      clause = `${col} is ${v}`;
    } else if (op === 'ilike' || op === 'like') {
      values.push(escapeLike(value));
      clause = `${col} ${op} $${values.length} escape '\\'`;
    } else {
      throw new Error(`Unsupported filter operator "${op}".`);
    }
    clauses.push(negate ? `not (${clause})` : clause);
  }
  return clauses.length ? ` where ${clauses.join(' and ')}` : '';
}

function buildSelect(raw) {
  if (!raw || raw === '*') return '*';
  return decodeURIComponent(raw).split(',').map((c) => ident(c.trim())).join(', ');
}

function buildOrder(raw) {
  if (!raw) return '';
  const parts = decodeURIComponent(raw).split(',').map((item) => {
    const [column, ...mods] = item.trim().split('.');
    let sql = ident(column);
    for (const mod of mods) {
      if (mod === 'asc' || mod === 'desc') sql += ` ${mod}`;
      else if (mod === 'nullslast') sql += ' nulls last';
      else if (mod === 'nullsfirst') sql += ' nulls first';
      else throw new Error(`Unsupported order modifier "${mod}".`);
    }
    return sql;
  });
  return ` order by ${parts.join(', ')}`;
}

const intParam = (raw, name) => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid ${name} "${raw}".`);
  return n;
};

function encodeValue(value, type, values) {
  if (value === undefined) return 'default';
  if (value === null) { values.push(null); return `$${values.length}`; }
  if (type && (type.udt === 'jsonb' || type.udt === 'json')) {
    values.push(JSON.stringify(value));
    return `$${values.length}::${type.udt}`;
  }
  values.push(value);
  return `$${values.length}`;
}

function preferences(headers = {}) {
  const raw = Object.entries(headers).find(([k]) => k.toLowerCase() === 'prefer')?.[1] || '';
  const prefs = Object.fromEntries(String(raw).split(',').map((p) => p.trim().split('=')).filter((p) => p[0]));
  return { returnRows: prefs.return === 'representation', resolution: prefs.resolution };
}

/** Run a Supabase-REST-style request against Postgres. Returns rows, or null for minimal responses. */
export async function pgRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const { table, params } = parsePath(path);
  const get = (name) => params.find(([k]) => k === name)?.[1];
  const filters = params.filter(([k]) => !RESERVED.has(k));
  const { returnRows, resolution } = preferences(options.headers);
  const cols = await columns(table);
  const values = [];
  const returning = returnRows ? ` returning ${buildSelect(get('select'))}` : '';
  let sql;

  try {
    if (method === 'GET') {
      sql = `select ${buildSelect(get('select'))} from ${ident(table)}${buildWhere(filters, values)}${buildOrder(get('order'))}`;
      if (get('limit') !== undefined) sql += ` limit ${intParam(get('limit'), 'limit')}`;
      if (get('offset') !== undefined) sql += ` offset ${intParam(get('offset'), 'offset')}`;
      return (await query(sql, values)).rows;
    }

    const body = options.body === undefined || options.body === null || options.body === ''
      ? undefined
      : typeof options.body === 'string' ? JSON.parse(options.body) : options.body;

    if (method === 'POST') {
      const rows = Array.isArray(body) ? body : [body];
      if (!rows.length || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) throw new Error('Insert body must be an object or an array of objects.');
      const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      keys.forEach(ident);
      const tuples = rows.map((r) => `(${keys.map((k) => encodeValue(r[k], cols.get(k), values)).join(', ')})`);
      sql = keys.length
        ? `insert into ${ident(table)} (${keys.map(ident).join(', ')}) values ${tuples.join(', ')}`
        : `insert into ${ident(table)} default values`;
      const target = get('on_conflict') ? ` (${decodeURIComponent(get('on_conflict')).split(',').map((c) => ident(c.trim())).join(', ')})` : '';
      if (resolution === 'ignore-duplicates') sql += ` on conflict${target} do nothing`;
      else if (resolution === 'merge-duplicates') {
        if (!target) throw new Error('merge-duplicates needs on_conflict.');
        const updates = keys.map((k) => `${ident(k)} = excluded.${ident(k)}`).join(', ');
        sql += updates ? ` on conflict${target} do update set ${updates}` : ` on conflict${target} do nothing`;
      }
      sql += returning;
      const result = await query(sql, values);
      return returnRows ? result.rows : null;
    }

    if (method === 'PATCH' || method === 'DELETE') {
      if (!filters.length) throw new Error(`${method} without a filter is not allowed.`);
      if (method === 'PATCH') {
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Update body must be an object.');
        const keys = Object.keys(body).filter((k) => body[k] !== undefined);
        if (!keys.length) throw new Error('Update body is empty.');
        const sets = keys.map((k) => `${ident(k)} = ${encodeValue(body[k], cols.get(k), values)}`).join(', ');
        sql = `update ${ident(table)} set ${sets}${buildWhere(filters, values)}${returning}`;
      } else {
        sql = `delete from ${ident(table)}${buildWhere(filters, values)}${returning}`;
      }
      const result = await query(sql, values);
      return returnRows ? result.rows : null;
    }
  } catch (error) {
    if (error?.code && !error.message.startsWith('Database request failed')) {
      throw Object.assign(new Error(`Database request failed (${error.code}). ${error.message}`), { code: error.code });
    }
    throw error;
  }
  throw new Error(`Unsupported method ${method}.`);
}

// ---- file storage (signed PDFs) ----
export async function putFile(bucket, path, bytes, contentType = 'application/octet-stream') {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  await query(
    `insert into crm_files (bucket, path, content_type, size_bytes, bytes) values ($1, $2, $3, $4, $5)
     on conflict (bucket, path) do update set content_type = excluded.content_type, size_bytes = excluded.size_bytes, bytes = excluded.bytes`,
    [bucket, path, contentType, buffer.length, buffer]
  );
}

export async function getFile(bucket, path) {
  const { rows } = await query('select content_type, bytes from crm_files where bucket = $1 and path = $2', [bucket, path]);
  return rows[0] ? { contentType: rows[0].content_type, bytes: rows[0].bytes } : null;
}

// ---- migrations ----
export async function migrate(dir, { log = () => {} } = {}) {
  const fs = await import('node:fs');
  const nodePath = await import('node:path');
  await query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
  const applied = new Set((await query('select name from schema_migrations')).rows.map((r) => r.name));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const ran = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(nodePath.join(dir, file), 'utf8');
    const client = await getPool().connect();
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      ran.push(file);
      log(`applied ${file}`);
    } catch (error) {
      await client.query('rollback').catch(() => {});
      throw Object.assign(new Error(`Migration ${file} failed: ${error.message}`), { cause: error });
    } finally {
      client.release();
    }
  }
  columnCache.clear();
  return ran;
}
