import { loadContent } from '../lib/store.js';
import { renderSales } from '../lib/render-sales.js';
import { renderUpsell } from '../lib/render-upsell.js';
import { UPSELL_PAGES } from '../lib/upsell-content.js';

const text = (body, status) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export async function GET(request) {
  try {
    const d = await loadContent();
    const q = new URL(request.url).searchParams;
    // /upsell e /downsell (depois da compra) usam esta mesma função: ?p=upsell|downsell
    const p = q.get('p');
    if (p) {
      if (!UPSELL_PAGES.includes(p)) return text('Página não encontrada.', 404);
      if (!d.upsells[p].enabled && !q.has('v')) return text('Página não encontrada.', 404);
      return new Response(renderUpsell(d, p), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300', 'x-robots-tag': 'noindex' },
      });
    }
    // Desligada no painel: some do ar (a prévia do painel, com ?v=, continua abrindo).
    if (!d.sales.enabled && !q.has('v')) return text('Página não encontrada.', 404);
    return new Response(renderSales(d), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('Falha ao carregar a página de vendas:', err);
    return text('Página temporariamente indisponível.', 503);
  }
}
