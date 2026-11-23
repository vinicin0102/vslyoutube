// Área de membros: alunos, configurações (curso, chave da IA) e uso do chat.
//
// Na Vercel fica no Postgres do Supabase (conexão POSTGRES_URL da integração);
// as tabelas são criadas sozinhas na primeira vez. No ambiente local
// (npm run dev) usa arquivos JSON na pasta .dev-data.

import postgres from 'postgres';
import { scrypt, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const APP_SCHEMA_SQL = `
create table if not exists public.app_members (
  email      text primary key,
  name       text not null default '',
  pass_hash  text,
  active     boolean not null default true,
  source     text not null default 'manual',
  created_at timestamptz not null default now(),
  last_login timestamptz
);
create table if not exists public.app_kv (
  k          text primary key,
  v          jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.app_chat_usage (
  email text not null,
  day   date not null,
  n     int  not null default 0,
  primary key (email, day)
);
alter table public.app_members enable row level security;
alter table public.app_kv enable row level security;
alter table public.app_chat_usage enable row level security;
revoke all on public.app_members, public.app_kv, public.app_chat_usage from anon, authenticated;
`;

const local = () => process.env.VSL_LOCAL_DIR;
const dbUrl = () => process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';

export const NO_DB_MSG =
  'Banco não conectado: a área de membros usa o Supabase (integração da Vercel, variável POSTGRES_URL). Conecte o Supabase ao projeto e faça Redeploy.';

export function membersConfigured() {
  return Boolean(local() || dbUrl());
}

/* ---------- conexão (Postgres) ---------- */

let sqlConn = null;
let schemaOk = null;
function db() {
  const url = dbUrl();
  if (!url) throw Object.assign(new Error(NO_DB_MSG), { expose: true });
  if (!sqlConn) {
    const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    // prepare: false -> funciona com o pooler do Supabase (modo transação).
    sqlConn = postgres(url, { ssl: isLocal ? false : 'require', max: 1, prepare: false, connect_timeout: 10, idle_timeout: 20, onnotice: () => {} });
  }
  return sqlConn;
}
async function pg() {
  const sql = db();
  schemaOk ??= sql.unsafe(APP_SCHEMA_SQL).simple().then(() => true).catch((err) => { schemaOk = null; throw err; });
  await schemaOk;
  return sql;
}

/* ---------- armazenamento local (npm run dev) ---------- */

async function lread(name, fallback) {
  try { return JSON.parse(await readFile(path.join(local(), name), 'utf8')); } catch { return fallback; }
}
async function lwrite(name, data) {
  await mkdir(local(), { recursive: true });
  await writeFile(path.join(local(), name), JSON.stringify(data, null, 1));
}

/* ---------- senhas ---------- */

const scryptP = (pw, salt) => new Promise((ok, fail) => scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? fail(e) : ok(k))));
export async function hashPassword(pw) {
  const salt = randomBytes(16);
  return `s1$${salt.toString('base64url')}$${(await scryptP(String(pw), salt)).toString('base64url')}`;
}
export async function checkPassword(pw, stored) {
  const [v, salt, hash] = String(stored || '').split('$');
  if (v !== 's1' || !salt || !hash) return false;
  const got = await scryptP(String(pw), Buffer.from(salt, 'base64url'));
  const want = Buffer.from(hash, 'base64url');
  return got.length === want.length && timingSafeEqual(got, want);
}

/* ---------- alunos ---------- */

export const normEmail = (e) => String(e || '').trim().toLowerCase();
export const validEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(e);

export async function getMember(email) {
  email = normEmail(email);
  if (local()) return (await lread('members.json', {}))[email] || null;
  const sql = await pg();
  const [m] = await sql`select email, name, pass_hash, active, source, created_at, last_login from app_members where email = ${email}`;
  return m || null;
}

/** Cria o aluno ou reativa; não mexe na senha de quem já existe. */
export async function upsertMember({ email, name = '', source = 'manual', active = true }) {
  email = normEmail(email);
  if (!validEmail(email)) throw Object.assign(new Error('E-mail inválido: ' + email), { expose: true });
  name = String(name || '').trim().slice(0, 120);
  if (local()) {
    const all = await lread('members.json', {});
    const old = all[email];
    all[email] = { email, name: name || old?.name || '', pass_hash: old?.pass_hash || null, active, source: old?.source || source, created_at: old?.created_at || new Date().toISOString(), last_login: old?.last_login || null };
    await lwrite('members.json', all);
    return { created: !old };
  }
  const sql = await pg();
  const [r] = await sql`
    insert into app_members (email, name, source, active) values (${email}, ${name}, ${source}, ${active})
    on conflict (email) do update set active = excluded.active, name = case when excluded.name <> '' then excluded.name else app_members.name end
    returning (xmax = 0) as created`;
  return { created: Boolean(r?.created) };
}

export async function updateMember(email, patch) {
  email = normEmail(email);
  if (local()) {
    const all = await lread('members.json', {});
    if (!all[email]) return false;
    Object.assign(all[email], patch);
    await lwrite('members.json', all);
    return true;
  }
  const sql = await pg();
  const cols = {};
  for (const k of ['name', 'pass_hash', 'active', 'last_login']) if (k in patch) cols[k] = patch[k];
  if (!Object.keys(cols).length) return false;
  const r = await sql`update app_members set ${sql(cols)} where email = ${email}`;
  return r.count > 0;
}

export async function deleteMember(email) {
  email = normEmail(email);
  if (local()) {
    const all = await lread('members.json', {});
    delete all[email];
    await lwrite('members.json', all);
    return;
  }
  const sql = await pg();
  await sql`delete from app_members where email = ${email}`;
}

export async function listMembers(q = '', limit = 300) {
  q = String(q || '').trim().toLowerCase();
  let rows, total;
  if (local()) {
    const all = Object.values(await lread('members.json', {}));
    total = all.length;
    rows = all.filter((m) => !q || m.email.includes(q) || (m.name || '').toLowerCase().includes(q))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
  } else {
    const sql = await pg();
    const like = '%' + q + '%';
    rows = await sql`select email, name, (pass_hash is not null) as has_password, active, source, created_at, last_login from app_members
      where ${q ? sql`(email ilike ${like} or name ilike ${like})` : sql`true`} order by created_at desc limit ${limit}`;
    [{ total }] = await sql`select count(*)::int as total from app_members`;
    return { total, members: rows };
  }
  return { total, members: rows.map(({ pass_hash, ...m }) => ({ ...m, has_password: Boolean(pass_hash) })) };
}

/* ---------- configurações (chave/valor) ---------- */

export async function kvGet(k, fallback = null) {
  if (local()) { const all = await lread('kv.json', {}); return k in all ? all[k] : fallback; }
  const sql = await pg();
  const [r] = await sql`select v from app_kv where k = ${k}`;
  return r ? r.v : fallback;
}
export async function kvSet(k, v) {
  if (local()) { const all = await lread('kv.json', {}); all[k] = v; await lwrite('kv.json', all); return; }
  const sql = await pg();
  await sql`insert into app_kv (k, v, updated_at) values (${k}, ${sql.json(v)}, now()) on conflict (k) do update set v = excluded.v, updated_at = now()`;
}

/* ---------- limite diário do chat ---------- */

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
/** Soma uma mensagem e devolve quantas o aluno já mandou hoje. */
export async function bumpChat(email) {
  email = normEmail(email);
  const day = today();
  if (local()) {
    const all = await lread('usage.json', {});
    const key = email + '|' + day;
    all[key] = (all[key] || 0) + 1;
    await lwrite('usage.json', all);
    return all[key];
  }
  const sql = await pg();
  const [r] = await sql`insert into app_chat_usage (email, day, n) values (${email}, ${day}, 1)
    on conflict (email, day) do update set n = app_chat_usage.n + 1 returning n`;
  return r.n;
}

/* ---------- sessão do aluno (cookie assinado) ---------- */

const MCOOKIE = 'm_s';
const MTTL = 60 * 24 * 3600; // 60 dias
const secureFlag = () => (local() ? '' : '; Secure');
// A assinatura inclui um pedaço do hash da senha: trocar/zerar a senha derruba as sessões.
const sigOf = (email, exp, ph) =>
  createHmac('sha256', process.env.SESSION_SECRET || 'dev').update(`m:${email}:${exp}:`).update(createHash('sha256').update(String(ph || '')).digest()).digest('base64url');

export function memberCookie(email, passHash) {
  const exp = Math.floor(Date.now() / 1000) + MTTL;
  const v = `${Buffer.from(email).toString('base64url')}.${exp}.${sigOf(email, exp, passHash)}`;
  return `${MCOOKIE}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MTTL}${secureFlag()}`;
}
export const clearMemberCookie = () => `${MCOOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag()}`;

/** Aluno logado e ativo, ou null. */
export async function currentMember(request) {
  const raw = request.headers.get('cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${MCOOKIE}=([A-Za-z0-9_-]+)\\.(\\d+)\\.([A-Za-z0-9_-]+)`));
  if (!m) return null;
  const email = Buffer.from(m[1], 'base64url').toString();
  const exp = Number(m[2]);
  if (!exp || exp < Date.now() / 1000) return null;
  const member = await getMember(email);
  if (!member || !member.active || !member.pass_hash) return null;
  const a = Buffer.from(m[3]), b = Buffer.from(sigOf(member.email, exp, member.pass_hash));
  return a.length === b.length && timingSafeEqual(a, b) ? member : null;
}
