// API da área de membros (alunos) e webhook de vendas.
//   GET  ?a=me | ?a=course
//   POST ?a=login | ?a=logout | ?a=chat
//   POST ?a=webhook&token=...   (plataforma de vendas avisa compra aprovada/reembolso)
import { json } from '../lib/auth.js';
import {
  membersConfigured, NO_DB_MSG, getMember, upsertMember, updateMember, hashPassword, checkPassword,
  memberCookie, clearMemberCookie, currentMember, normEmail, validEmail, kvGet, bumpChat,
} from '../lib/members.js';
import { courseDefaults, sanitizeCourse, settingsDefaults, sanitizeSettings } from '../lib/course.js';
import { askVet, cleanHistory } from '../lib/vet.js';
import { parseVideoUrl } from '../lib/content.js';
import { loadContent } from '../lib/store.js';
import { priceValue } from '../lib/render.js';
import { sendCapi, userData, saleDetails } from '../lib/meta.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const loadCourse = async () => sanitizeCourse((await kvGet('course')) || courseDefaults());
const loadSettings = async () => sanitizeSettings({}, { ...settingsDefaults(), ...((await kvGet('settings')) || {}) });

/** Vídeo da aula pronto para o player do aluno (com controles). */
function lessonVideo(v) {
  if (v.type === 'upload' && v.file) return { kind: 'file', src: v.file };
  if (v.type === 'embed' && v.embed.trim()) return { kind: 'embed', html: v.embed };
  if (v.type === 'url' && v.url) {
    const p = parseVideoUrl(v.url);
    if (p.kind === 'video') return { kind: 'file', src: p.src };
    if (p.kind === 'iframe') {
      let src = p.src.replace(/([?&])controls=0/, '$1controls=1');
      return { kind: 'iframe', src };
    }
  }
  return { kind: 'none' };
}

// Nome embaixo do ícone: até 12 letras ("O Segredo dos Bifinhos Caseiros" -> "Bifinhos").
const STOP = new Set(['o', 'a', 'os', 'as', 'de', 'da', 'do', 'dos', 'das', 'e', 'em', 'guia', 'segredo', 'curso', 'método', 'metodo']);
function shortName(name) {
  if (name.length <= 12) return name;
  const words = name.split(/\s+/).filter((w) => !STOP.has(w.toLowerCase()));
  let out = '';
  for (const w of words) { if ((out + ' ' + w).trim().length > 12) break; out = (out + ' ' + w).trim(); }
  return out || name.slice(0, 12);
}

/** Nome e ícones do app (PWA): do painel, ou o padrão que vem com o site. */
async function appInfo() {
  let s = null, title = '';
  try { s = await loadSettings(); title = (await loadCourse()).title; } catch {}
  const name = s?.app_name || title || 'Área de membros';
  const icon = s?.app_icon || '';
  return {
    name, short: shortName(name),
    icons: icon
      ? [{ src: icon, sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: icon, sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
      : [
          { src: '/media/app-any-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/media/app-any-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/media/app-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/media/app-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    apple: icon || '/media/app-apple-180.png',
  };
}

export async function GET(request) {
  const a = new URL(request.url).searchParams.get('a');
  if (a === 'app' || a === 'manifest') {
    const info = await appInfo();
    if (a === 'app') return json({ name: info.name, short: info.short, apple: info.apple }, 200, { 'cache-control': 'public, max-age=0, s-maxage=60' });
    const manifest = {
      id: '/membros', name: info.name, short_name: info.short, lang: 'pt-BR',
      description: 'Área de membros: aulas, bônus e chat 24h.',
      start_url: '/membros?app=1', scope: '/membros', display: 'standalone', orientation: 'portrait',
      background_color: '#121110', theme_color: '#121110', icons: info.icons,
    };
    return new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=60' } });
  }
  if (!membersConfigured()) return json({ error: NO_DB_MSG }, 503);
  try {
    const member = await currentMember(request);
    if (!member) return json({ error: 'Entre com o seu e-mail.', login: true }, 401);
    if (a === 'me') {
      const s = await loadSettings();
      return json({ email: member.email, name: member.name, support: s.support, assistant: s.assistant_name, chat: Boolean(s.ai_key), limit: s.chat_limit });
    }
    if (a === 'course') {
      const c = await loadCourse();
      return json({
        title: c.title, welcome: c.welcome,
        modules: c.modules.map((m) => ({ ...m, lessons: m.lessons.map(({ video, ...l }) => ({ ...l, video: lessonVideo(video) })) })),
      });
    }
    return json({ error: 'Ação inválida.' }, 400);
  } catch (err) {
    console.error('Área de membros (GET):', err);
    return json({ error: err.expose ? err.message : 'Não foi possível carregar agora.' }, 500);
  }
}

export async function POST(request) {
  const url = new URL(request.url);
  const a = url.searchParams.get('a');
  if (a === 'webhook') return webhook(request, url);
  if (!membersConfigured()) return json({ error: NO_DB_MSG }, 503);
  if (request.headers.get('x-m') !== '1') return json({ error: 'Requisição inválida.' }, 400);
  let body = {};
  try { body = await request.json(); } catch {}
  try {
    if (a === 'login') return await login(body);
    if (a === 'logout') return json({ ok: true }, 200, { 'set-cookie': clearMemberCookie() });
    if (a === 'chat') return await chat(request, body);
    return json({ error: 'Ação inválida.' }, 400);
  } catch (err) {
    console.error('Área de membros (POST):', err);
    return json({ error: err.expose ? err.message : 'Não foi possível concluir agora. Tente de novo.' }, err.status || 500);
  }
}

async function login(body) {
  const email = normEmail(body.email);
  const password = String(body.password || '');
  if (!validEmail(email)) return json({ error: 'Digite o e-mail usado na compra.' }, 400);
  const m = await getMember(email);
  if (!m || !m.active) {
    await wait(400);
    return json({ error: 'Não encontramos uma compra com este e-mail. Use o mesmo e-mail da compra ou fale com o suporte.' }, 404);
  }
  if (!m.pass_hash) {
    // Primeiro acesso: o aluno cria a senha agora.
    if (!password) return json({ first: true });
    if (password.length < 6) return json({ error: 'Crie uma senha com pelo menos 6 caracteres.', first: true }, 400);
    const pass_hash = await hashPassword(password);
    await updateMember(email, { pass_hash, last_login: new Date().toISOString() });
    return json({ ok: true, first: true }, 200, { 'set-cookie': memberCookie(email, pass_hash) });
  }
  if (!password) return json({ needPassword: true });
  if (!(await checkPassword(password, m.pass_hash))) {
    await wait(600);
    return json({ error: 'Senha incorreta. Se esqueceu, fale com o suporte para liberar uma nova.' }, 401);
  }
  await updateMember(email, { last_login: new Date().toISOString() });
  return json({ ok: true }, 200, { 'set-cookie': memberCookie(email, m.pass_hash) });
}

async function chat(request, body) {
  const member = await currentMember(request);
  if (!member) return json({ error: 'Sua sessão expirou. Entre de novo.', login: true }, 401);
  const history = cleanHistory(body.messages);
  if (!history.length) return json({ error: 'Escreva sua pergunta.' }, 400);
  const settings = await loadSettings();
  if (!settings.ai_key) return json({ error: 'O chat ainda não foi ativado. Tente mais tarde.' }, 503);
  const n = await bumpChat(member.email);
  if (n > settings.chat_limit) {
    return json({ error: `Você chegou ao limite de ${settings.chat_limit} mensagens de hoje. Amanhã o chat libera de novo. Se for urgente, procure um veterinário.` }, 429);
  }
  const reply = await askVet({ settings, course: await loadCourse(), member, history });
  return json({ reply, left: Math.max(0, settings.chat_limit - n) });
}

/* ---------- webhook das plataformas de venda ---------- */

// Procura campos pelo nome em qualquer nível do JSON (cada plataforma usa um formato).
function walk(obj, fn, pathKeys = []) {
  if (!obj || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    const p = [...pathKeys, k.toLowerCase()];
    if (v && typeof v === 'object') walk(v, fn, p);
    else fn(p, v);
  }
}
const APPROVED = /(approved|aprovad|\bpaid\b|\bpago\b|(^|[^a-z])complete|conclu|order_paid|venda_aprovada|^3$)/i;
const REVOKED = /(refund|reembols|chargeback|charged_back|cancel|devolv|dispute|protest|purchase_refunded|purchase_chargeback)/i;

export function parseSale(payload) {
  let email = '', name = '', statusTexts = [];
  const emails = [];
  walk(payload, (p, v) => {
    const key = p[p.length - 1];
    const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
    if (!s) return;
    if (/e-?mail/.test(key) && validEmail(normEmail(s))) {
      const ctx = p.join('.');
      const score = /(buyer|customer|client|comprador|cliente|cus_)/.test(ctx) ? 2 : /(producer|seller|affiliate|produtor|afiliado)/.test(ctx) ? -1 : 1;
      emails.push({ e: normEmail(s), score });
    }
    if (!name && /(^name$|full_?name|nome|first_name)/.test(key) && /(buyer|customer|client|comprador|cliente)/.test(p.join('.'))) name = s.slice(0, 120);
    if (/(status|event|evento|type|situacao|trans_status|order_status|webhook_event_type)/.test(key)) statusTexts.push(s);
  });
  emails.sort((a, b) => b.score - a.score);
  email = emails.find((x) => x.score >= 0)?.e || '';
  const st = statusTexts.join(' | ');
  const action = statusTexts.some((s) => REVOKED.test(s)) ? 'revoke' : statusTexts.some((s) => APPROVED.test(s)) ? 'grant' : 'ignore';
  return { email, name, action, status: st.slice(0, 200) };
}

async function webhook(request, url) {
  if (!membersConfigured()) return json({ ok: false, error: NO_DB_MSG }, 503);
  const settings = await loadSettings();
  const token = url.searchParams.get('token') || '';
  if (!settings.webhook_token || token !== settings.webhook_token) return json({ ok: false, error: 'token inválido' }, 401);
  let payload = {};
  const raw = await request.text();
  try { payload = JSON.parse(raw); } catch { payload = Object.fromEntries(new URLSearchParams(raw)); }
  const sale = parseSale(payload);
  if (!sale.email) return json({ ok: true, ignored: 'sem e-mail do comprador' });
  if (sale.action === 'grant') {
    const r = await upsertMember({ email: sale.email, name: sale.name, source: 'webhook', active: true });
    let capi = null;
    if (settings.capi_purchase) {
      // A mesma venda pode chegar mais de uma vez (aprovada, completa…): o event_id igual evita contar duas vezes.
      const det = saleDetails(payload);
      const content = await loadContent().catch(() => null);
      capi = await sendCapi(settings, content, {
        event_name: 'Purchase',
        event_id: 'compra-' + (det.order || sale.email),
        event_source_url: url.origin + '/oferta',
        user_data: userData({ email: sale.email, phone: det.phone, name: sale.name }),
        custom_data: { currency: 'BRL', value: det.value || priceValue(content?.sales?.offer_text || content?.cta?.offer_text) || 0, content_name: 'Guia' },
      });
    }
    return json({ ok: true, action: 'liberado', created: r.created, email: sale.email, pixel: capi?.sent ?? 0 });
  }
  if (sale.action === 'revoke') {
    const m = await getMember(sale.email);
    if (m) await updateMember(sale.email, { active: false });
    return json({ ok: true, action: 'bloqueado', email: sale.email });
  }
  return json({ ok: true, ignored: 'status sem ação: ' + sale.status });
}
