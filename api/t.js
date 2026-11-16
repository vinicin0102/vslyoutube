// Recebe os eventos de visualização da página pública (navigator.sendBeacon).
import { parseBeacon, recordBeacon, metricsConfigured } from '../lib/metrics.js';

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse/i;

export async function POST(request) {
  const done = new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  if (!metricsConfigured()) return done;
  if (!process.env.VSL_LOCAL_DIR && BOT.test(request.headers.get('user-agent') || '')) return done;
  let body;
  try {
    const text = await request.text();
    if (text.length > 2000) return done;
    body = JSON.parse(text);
  } catch {
    return done;
  }
  const beacon = parseBeacon(body);
  if (!beacon) return done;
  try {
    await recordBeacon(beacon);
  } catch (err) {
    console.error('Falha ao gravar métrica:', err?.message);
  }
  return done;
}
