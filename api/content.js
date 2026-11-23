import { isAuthed, sameOriginWrite, json } from '../lib/auth.js';
import { loadContent, saveContent, deleteMedia } from '../lib/store.js';
import { sanitize, mediaIn } from '../lib/content.js';
import { salesDefaults } from '../lib/sales-content.js';
import { upsellsDefaults } from '../lib/upsell-content.js';

export async function GET(request) {
  if (!isAuthed(request)) return json({ error: 'Faça login.' }, 401);
  // Modelo original da página de vendas (botão "Restaurar o modelo original" do painel).
  if (new URL(request.url).searchParams.get('defaults') === 'sales') return json(salesDefaults());
  if (new URL(request.url).searchParams.get('defaults') === 'upsells') return json(upsellsDefaults());
  return json(await loadContent());
}

export async function PUT(request) {
  if (!isAuthed(request)) return json({ error: 'Sessão expirada. Entre de novo; nada foi salvo.' }, 401);
  if (!sameOriginWrite(request)) return json({ error: 'Requisição inválida.' }, 400);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Dados inválidos.' }, 400);
  }
  const old = await loadContent().catch(() => null);
  // O contador de métricas só muda por "Zerar métricas" (api/metrics.js).
  const next = sanitize({ ...body, sales: body.sales ?? old?.sales, upsells: body.upsells ?? old?.upsells, metrics_epoch: old?.metrics_epoch ?? 0, updatedAt: Date.now() });
  try {
    await saveContent(next);
  } catch (err) {
    console.error('Falha ao salvar:', err);
    return json({ error: err.expose ? err.message : 'Não foi possível salvar. Confira se o Blob está conectado ao projeto.' }, 500);
  }
  // Apaga do Blob os arquivos que foram trocados ou removidos.
  if (old) {
    const keep = new Set(mediaIn(next));
    await deleteMedia(mediaIn(old).filter((u) => !keep.has(u)));
  }
  return json(next);
}
