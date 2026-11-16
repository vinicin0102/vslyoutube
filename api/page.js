import { loadContent } from '../lib/store.js';
import { renderPage } from '../lib/render.js';

export async function GET() {
  try {
    const html = renderPage(await loadContent());
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // CDN guarda por 30 s; alterações do painel aparecem em até ~1 min.
        'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('Falha ao carregar a página:', err);
    return new Response('Página temporariamente indisponível.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
}
