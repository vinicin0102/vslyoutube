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

export function metricsConfigured() {
  return Boolean(redisEnv() || process.env.VSL_LOCAL_DIR);
}

export const NO_REDIS_MSG =
  'Banco de métricas não conectado: na Vercel, abra Storage → Create Database → Upstash (Redis), conecte ao projeto e faça Redeploy.';

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
  return { epoch: int(b.e, 1e6), day: dayOf(start), sid: String(b.s), rec, first: Boolean(b.n) };
}

export async function recordBeacon(x) {
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

/** Relatório de um intervalo de dias (inclusive). */
export async function report(epoch, from, to) {
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
