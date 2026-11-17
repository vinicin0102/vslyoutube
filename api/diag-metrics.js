// Diagnóstico temporário das métricas no Supabase. Exige ?t=DIAG_TOKEN.
// Grava uma visita de teste numa contagem separada (época 999999) e lê o relatório.
import { createHash, timingSafeEqual } from 'node:crypto';
import { json } from '../lib/auth.js';
import { metricsBackend, parseBeacon, recordBeacon, report, today, schemaLog } from '../lib/metrics.js';

const sha = (s) => createHash('sha256').update(String(s)).digest();

export async function GET(request) {
  const url = new URL(request.url);
  const want = process.env.DIAG_TOKEN;
  if (!want || !timingSafeEqual(sha(url.searchParams.get('t') || ''), sha(want))) return json({ error: 'not found' }, 404);
  const out = { backend: metricsBackend(), env: {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL), SERVICE_ROLE: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    NON_POOLING: Boolean(process.env.POSTGRES_URL_NON_POOLING), POSTGRES_URL: Boolean(process.env.POSTGRES_URL) } };
  const sid = 'diag' + Date.now().toString(36);
  try {
    const b = parseBeacon({ s: sid, u: 'diagvisitor', t0: Date.now(), e: 999999, dv: 'm', src: 'diagnostico', p: 1, m: 42, d: 100, h: 1, c: 0, n: 1 });
    await recordBeacon(b);
    await recordBeacon(parseBeacon({ s: sid, u: 'diagvisitor', t0: Date.now(), e: 999999, dv: 'm', src: 'diagnostico', p: 0, m: 0, d: 0, h: 0, c: 1 }));
    out.gravacao = 'ok';
  } catch (e) {
    out.gravacao = 'ERRO: ' + e.message;
  }
  try {
    const r = await report(999999, today(), today());
    out.relatorio = { views: r.views, plays: r.plays, pitch: r.pitch, cta: r.cta, fontes: r.sources };
  } catch (e) {
    out.relatorio = 'ERRO: ' + e.message;
  }
  out.schema = schemaLog;
  return json(out);
}
