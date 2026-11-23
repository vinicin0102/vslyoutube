// Recebe os eventos de visualização da página pública (navigator.sendBeacon).
import { parseBeacon, recordBeacon, metricsConfigured } from '../lib/metrics.js';
import { membersConfigured, kvGet } from '../lib/members.js';
import { settingsDefaults } from '../lib/course.js';
import { loadContent } from '../lib/store.js';
import { sendCapi, userData, capiTargets } from '../lib/meta.js';

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse/i;

export async function POST(request) {
  const done = new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  if (!process.env.VSL_LOCAL_DIR && BOT.test(request.headers.get('user-agent') || '')) return done;
  let body;
  try {
    const text = await request.text();
    if (text.length > 2000) return done;
    body = JSON.parse(text);
  } catch {
    return done;
  }
  if (!(body && body.k === 'ic') && !metricsConfigured()) return done;
  if (body && body.k === 'ic') return initiateCheckout(request, body, done);
  const beacon = parseBeacon(body);
  if (!beacon) return done;
  try {
    await recordBeacon(beacon);
  } catch (err) {
    console.error('Falha ao gravar métrica:', err?.message);
  }
  return done;
}

/* ---------- InitiateCheckout pela API de Conversões ---------- */
const sentIds = new Set(); // evita repetir o mesmo clique na mesma instância
async function initiateCheckout(request, b, done) {
  try {
    const id = String(b.id || '').slice(0, 64);
    if (!/^[a-z0-9-]{8,64}$/i.test(id) || sentIds.has(id)) return done;
    sentIds.add(id); if (sentIds.size > 5000) sentIds.clear();
    if (!membersConfigured()) return done;
    const settings = { ...settingsDefaults(), ...((await kvGet('settings')) || {}) };
    const content = await loadContent();
    if (!capiTargets(settings, content).length) return done;
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const page = /^https?:\/\//.test(String(b.u || '')) ? String(b.u).slice(0, 500) : undefined;
    await sendCapi(settings, content, {
      event_name: 'InitiateCheckout',
      event_id: id,
      event_source_url: page,
      user_data: userData({ ip, ua: request.headers.get('user-agent') || '', fbp: String(b.fbp || '').slice(0, 120) || undefined, fbc: String(b.fbc || '').slice(0, 300) || undefined }),
      custom_data: Number(b.v) > 0 ? { currency: 'BRL', value: Number(b.v) } : {},
    });
  } catch (err) {
    console.error('InitiateCheckout pelo servidor falhou:', err?.message);
  }
  return done;
}
