import { isAuthed, sameOriginWrite, json } from '../lib/auth.js';
import { loadContent, saveContent } from '../lib/store.js';
import { metricsConfigured, NO_REDIS_MSG, report, today, addDays } from '../lib/metrics.js';
import { sanitize } from '../lib/content.js';

const RANGES = { today: [0, 0], yesterday: [-1, -1], '7d': [-6, 0], '30d': [-29, 0], '90d': [-89, 0] };

export async function GET(request) {
  if (!isAuthed(request)) return json({ error: 'Faça login.' }, 401);
  if (!metricsConfigured()) return json({ configured: false, error: NO_REDIS_MSG });
  const params = new URL(request.url).searchParams;
  const range = params.get('range') || '7d';
  const page = params.get('page') === 'oferta' ? 'oferta' : 'vsl';
  const [a, b] = RANGES[range] || RANGES['7d'];
  const t = today();
  try {
    const content = await loadContent();
    const data = await report(content.metrics_epoch, addDays(t, a), addDays(t, b), page);
    return json({ configured: true, range, page, pitchSec: page === 'vsl' ? content.cta.delay : 0, ...data });
  } catch (err) {
    console.error('Falha ao montar métricas:', err);
    return json({ error: err.expose ? err.message : 'Não foi possível carregar as métricas.' }, 500);
  }
}

/** Zerar métricas: começa uma nova contagem (os dados antigos expiram sozinhos). */
export async function POST(request) {
  if (!isAuthed(request)) return json({ error: 'Faça login.' }, 401);
  if (!sameOriginWrite(request)) return json({ error: 'Requisição inválida.' }, 400);
  try {
    const content = await loadContent();
    const next = sanitize({ ...content, metrics_epoch: content.metrics_epoch + 1, updatedAt: Date.now() });
    await saveContent(next);
    return json({ ok: true, content: next });
  } catch (err) {
    return json({ error: err.expose ? err.message : 'Não foi possível zerar.' }, 500);
  }
}
