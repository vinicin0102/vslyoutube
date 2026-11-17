// Métricas da VSL guardadas no Upstash Redis (integração da Vercel).
//
// Cada visita é uma "sessão" gravada num hash por dia:
//   vsl:m{época}:s:{AAAA-MM-DD}  ->  { sessão: "visitante|disp|origem|play|seg|duração|pitch|clique" }
// O navegador reenvia o estado completo da sessão a cada ~15 s de vídeo, então
// cada atualização custa um único HSET. Dias encerrados viram um resumo pronto
// (vsl:m{época}:a:{dia}) para os relatórios não relerem tudo.
// "Zerar métricas" só troca a época: os dados antigos expiram sozinhos.

const TZ = 'America/Sao_Paulo';
const RAW_TTL = 6 * 24 * 3600; // sessões brutas: 6 dias (o resumo fica)
const AGG_TTL = 400 * 24 * 3600;
const BUCKET = 5; // segundos por ponto da curva de retenção

/* ---------- Redis (REST do Upstash) ---------- */

function redisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

// Banco em memória só para o ambiente local (npm run dev).
const mem = globalThis.__vslMem ??= new Map();
function memExec([cmd, key, ...a]) {
  cmd = cmd.toUpperCase();
  if (cmd === 'HSET') { const h = mem.get(key) || {}; for (let i = 0; i < a.length; i += 2) h[a[i]] = String(a[i + 1]); mem.set(key, h); return 1; }
  if (cmd === 'HGETALL') { const h = mem.get(key) || {}; return Object.entries(h).flat(); }
  if (cmd === 'GET') return mem.get(key) ?? null;
  if (cmd === 'SET') { mem.set(key, a[0]); return 'OK'; }
  if (cmd === 'EXPIRE') return 1;
  throw new Error('comando não suportado no modo local: ' + cmd);
}

/* ---------- Supabase (REST/PostgREST) ---------- */

import postgres from 'postgres';
import { SCHEMA_SQL } from './metrics-sql.js';

// Com a integração Supabase da Vercel existe também a conexão direta ao banco:
// usamos ela só para criar a tabela sozinhos na primeira vez.
const dbUrls = () =>
  [process.env.POSTGRES_URL_NON_POOLING, process.env.POSTGRES_URL, process.env.DATABASE_URL].filter(Boolean);
let schemaReady = null;
const schemaLog = [];
async function runSchema(url) {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, { ssl: local ? false : 'require', max: 1, prepare: false, connect_timeout: 10, idle_timeout: 2 });
  try {
    await sql.unsafe(SCHEMA_SQL).simple();
  } finally {
    await sql.end({ timeout: 2 });
  }
}
function ensureSchema() {
  const urls = dbUrls();
  if (!urls.length) return Promise.resolve(false);
  schemaReady ??= (async () => {
    // Tenta a conexão direta e, se falhar, a do pooler.
    for (const url of urls) {
      try {
        await runSchema(url);
        schemaLog.push('tabela criada via ' + new URL(url).hostname);
        await new Promise((r) => setTimeout(r, 1200)); // tempo para a API recarregar o esquema
        return true;
      } catch (err) {
        schemaLog.push('falhou via ' + (() => { try { return new URL(url).hostname; } catch { return '?'; } })() + ': ' + err?.message);
        console.error('Falha ao criar a tabela das métricas:', err?.message);
      }
    }
    schemaReady = null;
    return false;
  })();
  return schemaReady;
}

function supaEnv() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

const NO_TABLE_MSG =
  'O Supabase está conectado, mas não foi possível criar a tabela das métricas sozinho: rode o arquivo sql/supabase-metricas.sql em Supabase → SQL Editor e atualize esta página.';

async function supa(path, body, prefer, retried) {
  const env = supaEnv();
  const headers = { apikey: env.key, 'content-type': 'application/json' };
  // Chave antiga (JWT) também vai no Authorization; a nova (sb_secret_...) só no apikey.
  if (env.key.startsWith('eyJ')) headers.authorization = 'Bearer ' + env.key;
  if (prefer) headers.prefer = prefer;
  const res = await fetch(env.url + '/rest/v1/' + path, { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.ok) return res.status === 204 ? null : res.json().catch(() => null);
  const err = await res.json().catch(() => ({}));
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(err.code) || res.status === 404) {
    // Tabela ainda não existe: cria e tenta de novo uma vez.
    if (!retried && (await ensureSchema())) return supa(path, body, prefer, true);
    throw Object.assign(new Error(NO_TABLE_MSG), { expose: true });
  }
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('O Supabase recusou a chave: confira SUPABASE_SERVICE_ROLE_KEY (use a chave secreta, não a "anon"/publishable).'), { expose: true });
  }
  throw new Error('Supabase respondeu ' + res.status + ': ' + (err.message || ''));
}

export function metricsBackend() {
  if (supaEnv()) return 'supabase';
  if (redisEnv()) return 'redis';
  return process.env.VSL_LOCAL_DIR ? 'local' : null;
}

export function metricsConfigured() {
  return Boolean(metricsBackend());
}

export const NO_REDIS_MSG =
  'Banco de métricas não conectado. Use o Supabase (crie as variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel e rode sql/supabase-metricas.sql) ou o Upstash Redis (Storage → Create Database). Depois faça Redeploy.';

/** Executa vários comandos numa ida só. */
export async function redis(cmds) {
  const env = redisEnv();
  if (!env) {
    if (process.env.VSL_LOCAL_DIR) return cmds.map(memExec);
    throw Object.assign(new Error(NO_REDIS_MSG), { expose: true });
  }
  const res = await fetch(env.url + '/pipeline', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.token, 'content-type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!res.ok) throw new Error('Redis respondeu ' + res.status);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error('Redis: ' + r.error);
    return r.result;
  });
}

/* ---------- datas no fuso de Brasília ---------- */

export const dayOf = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ms));
export const today = () => dayOf(Date.now());

export function addDays(day, n) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const keyRaw = (epoch, day) => `vsl:m${epoch}:s:${day}`;
const keyAgg = (epoch, day) => `vsl:m${epoch}:a:${day}`;

/* ---------- gravação (chamada pela página pública) ---------- */

const ID = /^[a-z0-9]{8,32}$/;
const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

/** Valida o envio do navegador; devolve null se for inválido. */
export function parseBeacon(b) {
  if (!b || typeof b !== 'object' || !ID.test(String(b.s)) || !ID.test(String(b.u))) return null;
  const now = Date.now();
  const t0 = Number(b.t0);
  const start = Number.isFinite(t0) && Math.abs(now - t0) < 36 * 3600 * 1000 ? t0 : now;
  const src = String(b.src || 'direto').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 40) || 'direto';
  const rec = [
    b.u,
    b.dv === 'm' ? 'm' : 'd',
    src,
    b.p ? 1 : 0,
    int(b.m, 36000),
    int(b.d, 36000),
    b.h ? 1 : 0,
    b.c ? 1 : 0,
  ].join('|');
  const row = {
    epoch: int(b.e, 1e6), day: dayOf(start), sid: String(b.s), uid: String(b.u),
    dev: b.dv === 'm' ? 'm' : 'd', src, played: Boolean(b.p), max_sec: int(b.m, 36000),
    dur: int(b.d, 36000), pitch: Boolean(b.h), cta: Boolean(b.c),
  };
  return { epoch: row.epoch, day: row.day, sid: row.sid, rec, row, first: Boolean(b.n) };
}

export async function recordBeacon(x) {
  if (metricsBackend() === 'supabase') {
    // A mesma visita atualiza a mesma linha, só acumulando (ver vsl_track no SQL).
    const r = x.row;
    await supa('rpc/vsl_track', {
      p_epoch: r.epoch, p_day: r.day, p_sid: r.sid, p_uid: r.uid, p_dev: r.dev, p_src: r.src,
      p_played: r.played, p_max_sec: r.max_sec, p_dur: r.dur, p_pitch: r.pitch, p_cta: r.cta,
    });
    return;
  }
  const key = keyRaw(x.epoch, x.day);
  const cmds = [['HSET', key, x.sid, x.rec]];
  if (x.first) cmds.push(['EXPIRE', key, RAW_TTL]);
  await redis(cmds);
}

/* ---------- relatórios ---------- */

const emptySeg = () => ({ views: 0, plays: 0, cta: 0 });

function aggregate(hash) {
  const a = { views: 0, plays: 0, pitch: 0, cta: 0, finish: 0, pctSum: 0, dur: 0, hist: {}, uv: 0, dev: {}, src: {} };
  const visitors = new Set();
  for (const rec of Object.values(hash)) {
    const [u, dv, src, p, m, d, h, c] = String(rec).split('|');
    const played = p === '1';
    const sec = Number(m) || 0;
    const dur = Number(d) || 0;
    a.views++;
    visitors.add(u);
    const seg = (a.dev[dv] ??= emptySeg());
    const sg = (a.src[src] ??= emptySeg());
    seg.views++;
    sg.views++;
    if (c === '1') { a.cta++; seg.cta++; sg.cta++; }
    if (h === '1') a.pitch++;
    if (!played) continue;
    a.plays++;
    seg.plays++;
    sg.plays++;
    const b = Math.floor(sec / BUCKET);
    a.hist[b] = (a.hist[b] || 0) + 1;
    if (dur > 0) {
      a.dur = Math.max(a.dur, dur);
      a.pctSum += Math.min(1, sec / dur);
      if (sec >= dur - 3 || sec >= dur * 0.97) a.finish++;
    }
  }
  a.uv = visitors.size;
  return a;
}

function hashFrom(flat) {
  if (!Array.isArray(flat)) return flat || {};
  const h = {};
  for (let i = 0; i < flat.length; i += 2) h[flat[i]] = flat[i + 1];
  return h;
}

/** Curva de retenção: quantos dos que deram play ainda assistiam em cada ponto. */
function retentionFrom(hist, plays, dur) {
  const last = dur ? Math.ceil(dur / BUCKET) : Math.max(0, ...Object.keys(hist).map(Number));
  const out = [];
  let still = plays;
  for (let b = 0; b <= last; b++) {
    out.push({ t: b * BUCKET, n: still });
    still -= Number(hist[b]) || 0;
  }
  return out;
}

async function reportSupabase(epoch, from, to) {
  const r = await supa('rpc/vsl_report', { p_epoch: epoch, p_from: from, p_to: to });
  const byDay = Object.fromEntries((r.daily || []).map((d) => [d.day, d]));
  const daily = [];
  for (let d = from; d <= to && daily.length < 92; d = addDays(d, 1)) {
    const x = byDay[d] || {};
    daily.push({ day: d, views: x.views || 0, plays: x.plays || 0, cta: x.cta || 0 });
  }
  return {
    from, to,
    views: r.views, uniques: r.uniques, plays: r.plays, pitch: r.pitch, cta: r.cta, finish: r.finish,
    avgWatch: r.plays ? r.pct_sum / r.plays : 0,
    duration: r.dur,
    retention: retentionFrom(r.hist || {}, r.plays, r.dur),
    daily,
    devices: r.devices || [],
    sources: r.sources || [],
  };
}

/** Relatório de um intervalo de dias (inclusive). */
export async function report(epoch, from, to) {
  if (metricsBackend() === 'supabase') return reportSupabase(epoch, from, to);
  const days = [];
  for (let d = from; d <= to && days.length < 92; d = addDays(d, 1)) days.push(d);
  const closedBefore = addDays(today(), -1); // ontem ainda pode receber envios atrasados

  const cached = await redis(days.map((d) => ['GET', keyAgg(epoch, d)]));
  const missing = days.filter((d, i) => !(d < closedBefore && cached[i]));
  const raws = missing.length ? await redis(missing.map((d) => ['HGETALL', keyRaw(epoch, d)])) : [];

  const perDay = {};
  const toCache = [];
  days.forEach((d, i) => {
    if (d < closedBefore && cached[i]) perDay[d] = JSON.parse(cached[i]);
  });
  missing.forEach((d, i) => {
    const a = aggregate(hashFrom(raws[i]));
    perDay[d] = a;
    if (d < closedBefore) toCache.push(['SET', keyAgg(epoch, d), JSON.stringify(a), 'EX', AGG_TTL]);
  });
  if (toCache.length) await redis(toCache).catch(() => {});

  const t = { views: 0, uv: 0, plays: 0, pitch: 0, cta: 0, finish: 0, pctSum: 0, dur: 0, hist: {}, dev: {}, src: {} };
  const daily = [];
  for (const d of days) {
    const a = perDay[d];
    daily.push({ day: d, views: a.views, plays: a.plays, cta: a.cta });
    for (const k of ['views', 'uv', 'plays', 'pitch', 'cta', 'finish', 'pctSum']) t[k] += a[k];
    t.dur = Math.max(t.dur, a.dur);
    for (const [b, n] of Object.entries(a.hist)) t.hist[b] = (t.hist[b] || 0) + n;
    for (const [group, dst] of [[a.dev, t.dev], [a.src, t.src]]) {
      for (const [k, v] of Object.entries(group)) {
        const s = (dst[k] ??= emptySeg());
        s.views += v.views; s.plays += v.plays; s.cta += v.cta;
      }
    }
  }

  // Curva de retenção: quantos dos que deram play ainda assistiam em cada ponto.
  const last = t.dur ? Math.ceil(t.dur / BUCKET) : Math.max(0, ...Object.keys(t.hist).map(Number));
  const retention = [];
  let still = t.plays;
  for (let b = 0; b <= last; b++) {
    retention.push({ t: b * BUCKET, n: still });
    still -= t.hist[b] || 0;
  }

  const sortSeg = (o) => Object.entries(o).map(([name, v]) => ({ name, ...v })).sort((x, y) => y.views - x.views);
  return {
    from, to,
    views: t.views, uniques: t.uv, plays: t.plays, pitch: t.pitch, cta: t.cta, finish: t.finish,
    avgWatch: t.plays ? t.pctSum / t.plays : 0,
    duration: t.dur,
    retention,
    daily,
    devices: sortSeg(t.dev),
    sources: sortSeg(t.src).slice(0, 15),
  };
}
