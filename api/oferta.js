import { loadContent } from '../lib/store.js';
import { renderSales } from '../lib/render-sales.js';

const text = (body, status) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export async function GET(request) {
  try {
    const d = await loadContent();
    // Desligada no painel: some do ar (a prévia do painel, com ?v=, continua abrindo).
    if (!d.sales.enabled && !new URL(request.url).searchParams.has('v')) return text('Página não encontrada.', 404);
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
