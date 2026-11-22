// HTML da página de vendas (/oferta): mini VSL no topo + carta de vendas, com a
// oferta montada como uma ficha de receita. Reaproveita o player, o pixel, o
// preço, o pop-up de saída e o rastreamento da VSL.

import { e, player, testimonial, offerHtml, pixelBase, priceValue, exitPopupHtml, imgAttrs, mediaTag, PAGE_SCRIPT, RATIO_CSS } from './render.js';
import { pixelIds } from './content.js';
import { metricsConfigured } from './metrics.js';

/* ---------- texto do painel -> HTML ---------- */

// **negrito** e ==destaque==; o resto é escapado.
const inline = (s) =>
  e(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/\n/g, '<br>');

/** Linha em branco = parágrafo; linhas começando com "- " = lista. */
export function rich(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const ls = b.split('\n');
      if (ls.every((l) => /^\s*[-•]\s+/.test(l))) return `<ul class="marks">${ls.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
      return `<p>${inline(b)}</p>`;
    })
    .join('\n');
}
const lines = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);
const pairs = (s) => lines(s).map((l) => { const i = l.indexOf('|'); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
// "🛁 Shampoo caseiro" -> ["🛁", "Shampoo caseiro"]
const splitEmoji = (s) => { const m = s.match(/^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u); return m ? [m[1], m[2]] : ['', s]; };

/** Preço antigo/novo para a barra fixa do celular. */
function priceParts(text) {
  const m = String(text || '').replace(/["“”'‘’]/g, ' ').replace(/\s+/g, ' ').trim().match(/^de\s+(.+?)\s+por\s+(?:apenas\s+|só\s+)?(.+?)$/i);
  const money = (v) => (/^[\d.,\s]+$/.test(v) ? 'R$ ' + v.trim() : v.trim());
  return m ? [money(m[1]), money(m[2])] : ['', ''];
}

// Carimbo "7 dias de garantia" (texto em volta de um círculo).
const STAMP = `<svg class="stamp-svg" viewBox="0 0 200 200" aria-hidden="true">
  <defs><path id="stamp-ring" d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0"/></defs>
  <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" stroke-width="5"/>
  <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <circle cx="100" cy="100" r="56" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <text font-size="17" font-weight="800" letter-spacing="3.2" fill="currentColor"><textPath href="#stamp-ring">GARANTIA INCONDICIONAL • RISCO ZERO •</textPath></text>
  <text x="100" y="108" text-anchor="middle" font-size="60" font-weight="900" fill="currentColor">7</text>
  <text x="100" y="134" text-anchor="middle" font-size="16" font-weight="800" letter-spacing="2" fill="currentColor">DIAS</text>
</svg>`;

export function renderSales(d) {
  const t = d.sales;
  const v = t.video;
  const { html: videoHtml, control } = v.type === 'none' ? { html: '', control: 'none' } : player(v);
  const custom = v.type === 'embed' && videoHtml;
  // Capa: aparece na hora, antes do vídeo carregar (só para a mini VSL que vem com o site).
  // A versão na URL faz quem já visitou baixar o vídeo novo (os arquivos de /media ficam 7 dias no celular).
  const MEDIA_V = '5';
  const poster = v.type === 'upload' && v.file === '/media/mini-vsl.mp4' ? `/media/mini-vsl.jpg?v=${MEDIA_V}` : '';
  const videoTag = poster ? videoHtml.replace('<video ', `<video poster="${poster}" `).replace('src="/media/mini-vsl.mp4"', `src="/media/mini-vsl.mp4?v=${MEDIA_V}"`) : videoHtml;
  const autoplay = Boolean(v.autoplay) && control !== 'none';
  const pauseImg = v.pause_image && control !== 'none' ? v.pause_image : '';
  const offerText = t.offer_text || d.cta.offer_text;
  const ctaUrl = t.cta_url || d.cta.url;
  const price = priceValue(offerText);
  const [oldPrice, newPrice] = priceParts(offerText);
  const pixels = pixelIds(`${d.meta_pixel_id},${process.env.META_PIXEL_ID || ''}`);
  const cfg = {
    page: 'oferta', pitch: 0, control, pause: Boolean(pauseImg), track: metricsConfigured(), e: d.metrics_epoch,
    px: pixels.length > 0, price, autoplay, reach: '#oferta',
  };
  const cta = (label = t.cta_text, cls = '') =>
    ctaUrl ? `<a class="cta${cls}" href="${e(ctaUrl)}" data-price="${price || ''}">${e(label)}</a>` : '<p class="nolink">Adicione o link do checkout no painel.</p>';
  const payNote = t.pay_note ? `<p class="pay">${e(t.pay_note)}</p>` : '';
  const tImgs = t.testimonial_images.length ? t.testimonial_images : d.testimonial_images;
  const showTesti = t.show_testimonials && (tImgs.length || d.testimonials.length);
  const includes = lines(t.includes);
  const bonus = pairs(t.bonus);
  const steps = pairs(t.steps);
  const faq = pairs(t.faq);
  const results = lines(t.results);
  const fig = (src, cap, cls) =>
    src ? `<figure class="snap ${cls}">${mediaTag(src, { alt: cap || '', sizes: '(max-width: 680px) 100vw, 520px', widths: [640, 960], extra: 'width="720" height="720"' })}${cap ? `<figcaption>${e(cap)}</figcaption>` : ''}</figure>` : '';
  // Marca própria da página de vendas; vazio = a mesma da VSL.
  const brandName = t.brand_name || d.brand_name;
  const logo = t.logo || d.logo;
  const favicon = t.favicon || d.favicon;
  const brand = logo ? `<img src="${e(logo)}" alt="${e(brandName)}">` : `<span>${e(brandName)}</span>`;
  const plainTitle = t.headline.replace(/==|\*\*/g, '');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(plainTitle || brandName)}</title>
<meta name="description" content="${e(t.subheadline)}">
<meta property="og:title" content="${e(plainTitle)}">
<meta property="og:description" content="${e(t.subheadline)}">
${t.product_image ? `<meta property="og:image" content="${e(t.product_image)}">` : ''}
${favicon ? `<link rel="icon" href="${e(favicon)}">\n<link rel="apple-touch-icon" href="${e(favicon)}">` : ''}
<meta name="theme-color" content="#143627">
${poster ? `<link rel="preload" as="image" href="${poster}" fetchpriority="high">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..112,400..900&family=Caveat:wght@700&family=Literata:ital,opsz,wght@0,7..72,400..600;1,7..72,400&display=swap" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..112,400..900&family=Caveat:wght@700&family=Literata:ital,opsz,wght@0,7..72,400..600;1,7..72,400&display=swap"></noscript>
<style>
  :root {
    --folha: #143627; --folha-2: #1d4a36; --folha-fundo: #0d261b;
    --salvia: #e6eedf; --papel: #fffdf7; --papel-borda: #ece4d0;
    --tinta: #1b221d; --tinta-2: #4b574e; --linha: #d3dccb;
    --abobora: ${t.cta_color}; --abobora-luz: #ffb15c;
    --carimbo: #b0391c; --preco: #0e7a37; --preco-luz: #6ee59a; --risco: #d92d20;
    --cta: var(--abobora);
    --display: 'Archivo', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    --carta: 'Literata', Georgia, 'Times New Roman', serif;
    --mao: 'Caveat', 'Comic Sans MS', cursive;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  /* Nada passa da largura da tela: a página não "balança" para os lados no celular. */
  html, body { max-width: 100%; overflow-x: hidden; }
  @supports (overflow: clip) { html, body { overflow-x: clip; } }
  body { margin: 0; background: var(--papel); color: var(--tinta); font: 400 17px/1.5 var(--display); -webkit-font-smoothing: antialiased; }
  img { max-width: 100%; height: auto; display: block; }
  a { color: inherit; }
  .wrap { width: 100%; max-width: 680px; margin: 0 auto; padding: 0 20px; }
  .wide { max-width: 1080px; }
  section { padding: 64px 0; }
  .h2 { margin: 0 0 22px; font-family: var(--display); font-weight: 800; font-stretch: 108%; font-size: clamp(27px, 6vw, 40px); line-height: 1.08; letter-spacing: -.018em; color: var(--folha); text-wrap: balance; }
  .kicker { display: inline-block; margin: 0 0 12px; font: 700 13px/1.2 var(--display); letter-spacing: .1em; text-transform: uppercase; color: var(--carimbo); }
  .kicker::before { content: ""; display: inline-block; width: 8px; height: 8px; margin: -2px 8px 0 0; vertical-align: middle; border-radius: 50%; background: currentColor; }
  .center { text-align: center; }

  /* Texto corrido com cara de carta */
  .prose { font-family: var(--carta); font-size: 19px; line-height: 1.68; }
  .prose p { margin: 0 0 1.05em; }
  .prose strong { font-weight: 600; color: #000; }
  .prose mark { background: linear-gradient(transparent 52%, #ffd3a1 52%, #ffd3a1 92%, transparent 92%); color: inherit; padding: 0 .12em; }
  .marks { list-style: none; margin: 0 0 1.1em; padding: 0; }
  .marks li { position: relative; padding: 6px 0 6px 34px; }
  .marks li::before { content: "✕"; position: absolute; left: 4px; top: 6px; font: 800 17px/1.68 var(--display); color: var(--risco); }

  /* Botão de compra */
  .buy { text-align: center; }
  .cta { display: block; width: 100%; max-width: 460px; margin: 0 auto; padding: 19px 22px; border-radius: 14px; background: var(--abobora); color: #fff; text-decoration: none;
    font: 800 18px/1.15 var(--display); font-stretch: 106%; letter-spacing: .015em; text-align: center;
    box-shadow: 0 5px 0 color-mix(in srgb, var(--abobora) 62%, #000), 0 16px 30px -12px color-mix(in srgb, var(--abobora) 70%, transparent);
    transition: transform .12s ease, box-shadow .12s ease; }
  .cta::after { content: " →"; }
  .cta:hover { transform: translateY(-2px); }
  .cta:active { transform: translateY(4px); box-shadow: 0 1px 0 color-mix(in srgb, var(--abobora) 62%, #000); }
  .cta:focus-visible { outline: 3px solid var(--abobora-luz); outline-offset: 4px; }
  .pay { margin: 14px 0 0; font-size: 13.5px; color: var(--tinta-2); }
  .pay::before { content: "🔒 "; }
  .nolink { padding: 14px; border: 2px dashed var(--risco); border-radius: 12px; color: var(--risco); font-weight: 700; }
  .price { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 2px 10px; margin: 0 0 16px; font-weight: 700; }
  .price .lbl { font-size: 15px; color: var(--tinta-2); font-weight: 600; }
  .price .old { position: relative; display: inline-block; padding: 0 4px; color: var(--risco); font-size: 20px; }
  .price .old::before, .price .old::after { content: ""; position: absolute; left: -2px; right: -2px; top: 50%; height: 2px; background: var(--risco); border-radius: 2px; }
  .price .old::before { transform: rotate(16deg); }
  .price .old::after { transform: rotate(-16deg); }
  .price .new { font-size: 34px; font-weight: 900; font-stretch: 104%; color: var(--preco); letter-spacing: -.02em; }
  .offer { margin: 0 0 14px; font-weight: 700; white-space: pre-line; }

  /* Faixa de confiança */
  .strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 14px; background: var(--folha-fundo); color: #cfe2d4; font-size: 13px; text-align: center; padding: 8px 12px; }
  .strip span { white-space: nowrap; }
  .strip b { color: var(--abobora-luz); font-weight: 800; }

  /* Topo */
  .hero { position: relative; padding: 26px 0 44px; color: #eef5ef; overflow: hidden;
    background: radial-gradient(90% 60% at 85% 0%, #24573f 0%, transparent 70%), var(--folha); }
  .brand { display: flex; justify-content: center; margin-bottom: 22px; font: 800 16px var(--display); letter-spacing: .02em; color: #fff; }
  .brand img { max-height: 34px; width: auto; }
  .hero-grid { display: grid; gap: 22px; grid-template-areas: "copy" "video" "buy" "lede"; }
  .hero-copy { grid-area: copy; text-align: center; }
  .hero .kicker { color: var(--abobora-luz); }
  h1 { margin: 0; font-family: var(--display); font-weight: 800; font-stretch: 110%; font-size: clamp(26px, 7vw, 52px); line-height: 1.06; letter-spacing: -.022em; text-wrap: balance; }
  h1 mark { color: var(--abobora-luz); background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 12' preserveAspectRatio='none'%3E%3Cpath d='M2 8.5C40 3 90 2.5 198 6' fill='none' stroke='%23e8590c' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E") 0 100% / 100% .3em no-repeat;
    padding-bottom: .1em; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  .lede { grid-area: lede; margin: 0; text-align: center; font-family: var(--carta); font-size: 17px; line-height: 1.6; color: #cfe0d3; }
  .hero-video { grid-area: video; position: relative; margin-top: 16px; }
  .watch { position: absolute; z-index: 5; top: -6px; left: 50%; transform: translate(-50%, -100%) rotate(-3deg); font: 700 23px/1 var(--mao); color: var(--abobora-luz); white-space: nowrap; }
  .hero-buy { grid-area: buy; }
  .hero-buy .price .lbl, .hero-buy .pay { color: #b9cfbf; }
  .hero-buy .price .new { color: var(--preco-luz); }
  .player { position: relative; width: 100%; max-width: ${v.ratio === '16:9' ? '640px' : '330px'}; margin: 22px auto 0; aspect-ratio: ${RATIO_CSS[v.ratio] || '9 / 16'};
    border-radius: 22px; overflow: hidden; background: #000; box-shadow: 0 0 0 6px rgba(255,255,255,.07), 0 34px 60px -24px rgba(0,0,0,.7); }
  .player.custom { aspect-ratio: auto; background: none; box-shadow: none; border-radius: 0; max-width: 100%; }
  .player video, .player iframe, .player #vsl-img { width: 100%; height: 100%; border: 0; display: block; object-fit: cover; background: #000; }
  .player-empty { height: 100%; display: grid; place-items: center; padding: 24px; text-align: center; color: #9fb5a6; font-size: 14px; background: var(--folha-2); }
  .pause-overlay { position: absolute; inset: -1px; z-index: 2; display: block; width: calc(100% + 2px); height: calc(100% + 2px); padding: 0; border: 0; background: #000; cursor: pointer; }
  .pause-overlay[hidden], .play-cover[hidden], .tap-layer[hidden], .unmute[hidden] { display: none; }
  .pause-overlay img, .pause-overlay video { width: 100%; height: 100%; object-fit: contain; display: block; }
  .tap-layer { position: absolute; inset: 0; z-index: 1; cursor: pointer; }
  .play-cover { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; width: 100%; height: 100%; padding: 0; border: 0; cursor: pointer; background: radial-gradient(circle, rgba(0,0,0,.1), rgba(0,0,0,.45)); }
  .play-cover .pc { width: 84px; height: 84px; border-radius: 50%; background: var(--abobora); display: grid; place-items: center; box-shadow: 0 0 0 10px color-mix(in srgb, var(--abobora) 30%, transparent), 0 10px 30px rgba(0,0,0,.5); }
  .play-cover .pc::after { content: ""; margin-left: 7px; border-left: 28px solid #fff; border-top: 18px solid transparent; border-bottom: 18px solid transparent; }
  .unmute { position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; width: 100%; height: 100%; padding: 16px; border: 0; background: rgba(0,0,0,.25); cursor: pointer; font: inherit; color: #fff; }
  .unmute .box { display: grid; justify-items: center; gap: 4px; max-width: 250px; padding: 16px 20px; border-radius: 16px; background: var(--abobora); box-shadow: 0 10px 30px rgba(0,0,0,.45); text-align: center; animation: nudge 1.8s ease-in-out infinite; }
  .unmute .ico { font-size: 36px; line-height: 1; }
  .unmute b { font: 800 18px/1.2 var(--display); }
  .unmute span { font-size: 14px; }
  @keyframes nudge { 50% { transform: scale(1.05); } }
  .unmute:focus-visible .box, .play-cover:focus-visible .pc { outline: 3px solid #fff; outline-offset: 4px; }
  .pause-overlay:focus-visible { outline: 3px solid #fff; outline-offset: -3px; }
  @media (min-width: 900px) {
    .hero { padding: 30px 0 72px; }
    .brand { justify-content: flex-start; margin-bottom: 34px; }
    .hero-grid { grid-template-columns: minmax(0, 1fr) 360px; column-gap: 64px; row-gap: 26px; align-items: start;
      grid-template-areas: "copy video" "lede video" "buy video"; grid-template-rows: auto auto 1fr; }
    .hero-copy, .lede { text-align: left; }
    .hero-buy, .hero-buy .buy { text-align: left; }
    .hero-buy .price { justify-content: flex-start; }
    .hero-buy .cta { margin: 0; }
    .player { margin-top: 0; max-width: 360px; }
    .hero-video { margin-top: 0; }
    .watch { left: auto; right: calc(100% + 8px); top: 40px; transform: rotate(-6deg); }
    .watch::after { content: " →"; }
  }

  /* Depoimentos */
  .proof { background: var(--salvia); }
  .t-gallery { margin: 0 auto; columns: 1; column-gap: 18px; }
  .t-gallery img, .t-gallery video { display: block; width: 100%; margin: 0 0 16px; break-inside: avoid; border-radius: 12px; cursor: zoom-in; box-shadow: 0 10px 26px -14px rgba(20,54,39,.45); }
  @media (max-width: 600px) { .t-gallery { width: 100vw; margin-left: calc(50% - 50vw); } .t-gallery img, .t-gallery video { border-radius: 0; margin-bottom: 10px; box-shadow: none; } }
  @media (min-width: 760px) { .t-gallery { columns: 2; max-width: 960px; } .t-gallery.one { columns: 1; max-width: 560px; } }
  .zoom { position: fixed; inset: 0; z-index: 400; background: rgba(0,0,0,.94); overflow: auto; display: flex; }
  .zoom[hidden] { display: none; }
  .zoom img { margin: auto; max-width: none; min-width: 100%; }
  @media (min-width: 601px) { .zoom img { min-width: 0; max-width: 100%; } }
  .zoom-close { position: fixed; top: 12px; right: 12px; z-index: 401; width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgba(255,255,255,.16); color: #fff; font-size: 22px; cursor: pointer; }
  .t-list { display: grid; gap: 14px; margin-top: 18px; }
  .t { display: flex; gap: 14px; padding: 18px; border-radius: 14px; background: var(--papel); box-shadow: 0 1px 0 var(--linha); }
  .avatar { flex: 0 0 44px; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: var(--folha-2); color: #fff; font-weight: 800; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .t-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; margin-bottom: 4px; }
  .t-name { font-weight: 800; }
  .t-city { color: var(--tinta-2); font-size: 13px; }
  .stars { color: #e8a317; font-size: 13px; letter-spacing: 1px; }
  .t-text { margin: 0; font-family: var(--carta); font-size: 16.5px; line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; }
  .t-photo { margin-top: 10px; max-width: 280px; border-radius: 10px; }

  /* Fotos com legenda escrita à mão */
  .snap { margin: 34px 0; }
  .snap img, .snap video { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 16px; }
  .snap figcaption { margin: 10px 6px 0; font: 700 25px/1.1 var(--mao); color: var(--tinta-2); transform: rotate(-1.5deg); }
  .snap figcaption::before { content: "↑ "; }
  @media (min-width: 760px) { .snap.tilt { width: 78%; margin-left: auto; margin-right: auto; } }

  .letter .prose:first-child > p:first-child::first-letter { float: left; margin: .06em .1em 0 0; font: 900 3.4em/.8 var(--display); color: var(--folha); }
  .why { background: var(--salvia); }

  /* Produto */
  .product { background: var(--folha); color: #e6efe8; text-align: center; }
  .product .h2 { color: #fff; }
  .product .kicker { color: var(--abobora-luz); }
  .product p.txt { margin: 0 auto 8px; max-width: 560px; font-family: var(--carta); font-size: 18.5px; line-height: 1.65; color: #d6e5da; }
  .product img, .product video { display: block; width: 100%; max-width: 620px; margin: 18px auto 26px; filter: drop-shadow(0 30px 40px rgba(0,0,0,.45)); }
  .product .price .lbl, .product .pay { color: #b9cfbf; }
  .product .price .new { color: var(--preco-luz); }

  /* Resultados */
  .results-grid { display: grid; gap: 28px; align-items: center; }
  .results-grid img, .results-grid video { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 20px; }
  .checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
  .checks li { position: relative; padding-left: 40px; font-size: 18px; line-height: 1.45; font-weight: 600; }
  .checks li::before { content: "✓"; position: absolute; left: 0; top: 0; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--preco); color: #fff; font-size: 15px; font-weight: 900; }
  @media (min-width: 860px) { .results-grid { grid-template-columns: 420px 1fr; gap: 56px; } .results .h2 { text-align: left; } }

  /* Oferta: a ficha de receita */
  .offer-sec { background: var(--salvia); padding-top: 80px; }
  .ficha { position: relative; max-width: 620px; margin: 0 auto; padding: 40px 22px 30px 50px; border-radius: 4px 4px 18px 18px; background: var(--papel);
    box-shadow: 0 1px 0 var(--papel-borda), 0 2px 0 #e3dbc6, 0 30px 60px -28px rgba(20,54,39,.5); }
  .ficha::before { content: ""; position: absolute; top: 0; bottom: 0; left: 30px; width: 2px; background: rgba(217,45,32,.4); box-shadow: 5px 0 0 rgba(217,45,32,.18); }
  .ficha::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 10px; border-radius: 4px 4px 0 0; background: repeating-linear-gradient(90deg, var(--folha) 0 18px, var(--folha-2) 18px 36px); }
  .ficha-tag { margin: 0; font: 700 27px/1 var(--mao); color: var(--carimbo); }
  .ficha h2 { margin: 6px 0 16px; padding-right: 90px; font: 800 clamp(25px, 6vw, 32px)/1.08 var(--display); font-stretch: 106%; letter-spacing: -.015em; color: var(--folha); }
  .meta { display: flex; flex-wrap: wrap; gap: 0; margin: 0; padding: 12px 0; border-top: 1.5px solid var(--papel-borda); border-bottom: 1.5px solid var(--papel-borda); }
  .meta div { flex: 1 1 0; min-width: 0; padding: 0 12px; border-left: 1.5px solid var(--papel-borda); }
  .meta div:first-child { padding-left: 0; border-left: 0; }
  .meta dt { font: 700 11px/1.2 var(--display); letter-spacing: .1em; text-transform: uppercase; color: var(--tinta-2); }
  .meta dd { margin: 3px 0 0; font: 700 15px/1.25 var(--display); }
  .ficha h3 { margin: 26px 0 4px; font: 800 12.5px/1.3 var(--display); letter-spacing: .12em; text-transform: uppercase; color: var(--tinta-2); }
  .ficha h3 small { font-weight: 600; letter-spacing: .04em; text-transform: none; font-size: 13px; }
  .leaders { list-style: none; margin: 0; padding: 0; }
  .leaders li { display: flex; align-items: baseline; gap: 8px; padding: 11px 0; border-bottom: 1px solid #f1ebdb; }
  .leaders .it { flex: 0 1 auto; font-size: 16.5px; line-height: 1.35; font-weight: 600; }
  .leaders .it small { display: block; margin-top: 2px; font-weight: 400; font-size: 14.5px; color: var(--tinta-2); }
  .leaders .em { margin-right: 4px; }
  .leaders i { flex: 1 1 14px; min-width: 14px; border-bottom: 2px dotted #c9bea2; transform: translateY(-5px); }
  .leaders b { flex: none; font: 800 12px/1 var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--preco); }
  .leaders .bn b { color: var(--carimbo); }
  .chat { display: flex; gap: 14px; margin-top: 22px; padding: 16px; border-radius: 14px; background: #e9f6ee; border: 1.5px solid #b9dfc8; }
  .chat .ic { flex: none; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; background: var(--preco); color: #fff; font-size: 22px; }
  .chat strong { display: block; font: 800 17px/1.25 var(--display); color: var(--folha); }
  .chat .pill { display: inline-block; margin: 4px 0 6px; padding: 3px 8px; border-radius: 999px; background: var(--preco); color: #fff; font: 800 10.5px/1.2 var(--display); letter-spacing: .1em; }
  .chat p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--tinta-2); }
  .total { margin-top: 28px; padding-top: 24px; border-top: 2px dashed #d8cdb0; text-align: center; }
  .total .intro { margin: 0 auto 16px; max-width: 470px; font-family: var(--carta); font-style: italic; font-size: 17px; line-height: 1.55; color: var(--tinta-2); }
  .total .price .new { font-size: clamp(40px, 11vw, 54px); }
  .stamp { position: absolute; top: -30px; right: -14px; width: 116px; color: var(--carimbo); transform: rotate(14deg); opacity: .9; mix-blend-mode: multiply; }
  .stamp-svg { display: block; width: 100%; height: auto; font-family: var(--display); }
  .js .ficha:not(.in) .stamp { opacity: 0; transform: rotate(-4deg) scale(1.7); }
  .js .ficha.in .stamp { transition: transform .38s cubic-bezier(.3,1.6,.5,1), opacity .2s ease-out; transition-delay: .35s; }
  @media (max-width: 420px) { .ficha { padding-left: 40px; padding-right: 16px; } .ficha::before { left: 22px; } .stamp { width: 96px; top: -26px; right: -8px; } .ficha h2 { padding-right: 64px; } }

  /* Como você recebe */
  .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; counter-reset: step; }
  .steps li { position: relative; padding: 18px 18px 18px 72px; border-radius: 16px; background: #fff; border: 1.5px solid var(--papel-borda); counter-increment: step; }
  .steps li::before { content: counter(step); position: absolute; left: 18px; top: 16px; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: var(--folha); color: #fff; font: 900 18px var(--display); }
  .steps strong { display: block; font: 800 18px/1.25 var(--display); color: var(--folha); }
  .steps span { display: block; margin-top: 3px; font-size: 15.5px; color: var(--tinta-2); }
  @media (min-width: 860px) { .steps { grid-template-columns: repeat(3, 1fr); } }

  /* Garantia */
  .guarantee { background: var(--folha); color: #dfeae2; }
  .g-grid { display: grid; gap: 26px; justify-items: center; text-align: center; }
  .g-grid .stamp-svg { width: 170px; color: var(--abobora-luz); transform: rotate(-8deg); }
  .guarantee .h2 { color: #fff; }
  .guarantee p { margin: 0; font-family: var(--carta); font-size: 18px; line-height: 1.65; }
  @media (min-width: 760px) { .g-grid { grid-template-columns: 190px 1fr; text-align: left; justify-items: start; gap: 44px; align-items: center; } }

  /* Perguntas */
  .faq details { border-bottom: 1.5px solid var(--linha); }
  .faq summary { position: relative; padding: 20px 40px 20px 0; list-style: none; cursor: pointer; font: 700 18px/1.35 var(--display); color: var(--folha); }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::after { content: "+"; position: absolute; right: 4px; top: 50%; transform: translateY(-50%); font: 400 30px/1 var(--display); color: var(--abobora); transition: transform .2s; }
  .faq details[open] summary::after { transform: translateY(-50%) rotate(45deg); }
  .faq summary:focus-visible { outline: 3px solid var(--abobora); outline-offset: 2px; }
  .faq .ans { padding: 0 0 20px; font-family: var(--carta); font-size: 17px; line-height: 1.65; color: var(--tinta-2); }

  .ps { background: var(--salvia); }
  .ps .prose { margin-bottom: 30px; }

  footer { background: var(--folha-fundo); color: #8fa797; padding: 36px 20px 120px; font-size: 12.5px; text-align: center; }
  footer p { max-width: 680px; margin: 0 auto 8px; white-space: pre-line; }

  /* Barra fixa do celular */
  .bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 90; display: flex; align-items: center; justify-content: center; gap: 14px;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom)); background: rgba(13,38,27,.96); color: #fff;
    -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); transform: translateY(110%); transition: transform .28s ease; }
  .bar.on { transform: none; }
  .bar .bp { line-height: 1.1; white-space: nowrap; }
  .bar s { display: block; font-size: 12.5px; color: #ff8c84; }
  .bar b { font: 900 21px var(--display); color: var(--preco-luz); }
  .bar .cta { flex: 0 1 300px; width: auto; margin: 0; padding: 14px 16px; font-size: 15px; box-shadow: 0 3px 0 color-mix(in srgb, var(--abobora) 62%, #000); }

  /* Pop-up de saída */
  .exitpop { position: fixed; inset: 0; z-index: 300; display: grid; place-items: center; padding: 18px; background: rgba(9,26,18,.8); }
  .exitpop[hidden] { display: none; }
  .exitpop .card { position: relative; width: 100%; max-width: 420px; max-height: calc(100vh - 36px); overflow: auto; padding: 28px 22px 20px; border-radius: 20px;
    background: var(--papel); color: var(--tinta); text-align: center; box-shadow: 0 30px 70px rgba(0,0,0,.5); animation: pop .32s cubic-bezier(.2,.9,.2,1.2); }
  @keyframes pop { from { transform: scale(.88); opacity: 0; } }
  .exitpop .card:focus { outline: none; }
  .exitpop .x { position: absolute; top: 8px; right: 8px; width: 40px; height: 40px; border: 0; border-radius: 50%; background: rgba(0,0,0,.06); font-size: 18px; cursor: pointer; }
  .exitpop .etag { display: inline-block; padding: 5px 12px; border-radius: 6px; background: var(--risco); color: #fff; font: 900 13px var(--display); letter-spacing: .08em; }
  .exitpop h2 { margin: 12px 0 8px; font: 800 25px/1.15 var(--display); color: var(--folha); }
  .exitpop .etext { margin: 0 0 12px; font-family: var(--carta); font-size: 16.5px; line-height: 1.55; color: var(--tinta-2); }
  .exitpop .eimg { display: block; width: 100%; max-height: 220px; object-fit: contain; margin: 4px 0 10px; }
  .exitpop .enote { margin: 12px 0 0; font-size: 13px; color: var(--tinta-2); }
  .exitpop .nothanks { margin-top: 10px; background: none; border: 0; color: var(--tinta-2); font-size: 13px; text-decoration: underline; cursor: pointer; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
    .js .ficha:not(.in) .stamp { opacity: .9; transform: rotate(14deg); }
  }
</style>
<script>document.documentElement.classList.add('js');</script>
${pixels.length ? pixelBase(pixels) : ''}
${d.head_code}
</head>
<body>
<div class="strip"><span><b>✓</b> Acesso imediato</span><span><b>✓</b> 7 dias de garantia</span><span><b>✓</b> Pix ou cartão</span></div>

<header class="hero">
  <div class="wrap wide">
    <div class="brand">${brand}</div>
    <div class="hero-grid">
      <div class="hero-copy">
        ${t.tag ? `<p class="kicker">${e(t.tag)}</p>` : ''}
        <h1>${inline(t.headline)}</h1>
      </div>
      ${t.subheadline ? `<p class="lede">${inline(t.subheadline)}</p>` : ''}
      ${videoHtml || v.type !== 'none' ? `<div class="hero-video">
        ${control !== 'none' ? '<span class="watch" aria-hidden="true">assista antes</span>' : ''}
        <div class="player${custom ? ' custom' : ''}">
          ${videoTag || '<div class="player-empty">Nenhum vídeo configurado.<br>Adicione o vídeo pelo painel.</div>'}
          ${control !== 'none' ? '<div class="tap-layer" id="vsl-tap" hidden></div><button type="button" class="play-cover" id="vsl-play" aria-label="Assistir ao vídeo"><span class="pc"></span></button>' : ''}
          ${autoplay ? '<button type="button" class="unmute" id="vsl-unmute" hidden aria-label="Ativar o som do vídeo"><span class="box"><span class="ico">🔊</span><b>Seu vídeo já começou</b><span>Toque para ouvir</span></span></button>' : ''}
          ${pauseImg ? `<button type="button" class="pause-overlay" id="vsl-pause" hidden aria-label="Continuar assistindo">${/\.(mp4|webm)(\?|$)/i.test(pauseImg) ? `<video src="${e(pauseImg)}" muted loop playsinline preload="metadata"></video>` : `<img src="${e(pauseImg)}" alt="">`}</button>` : ''}
        </div>
      </div>` : ''}
      <div class="hero-buy" id="hero-buy"><div class="buy">${offerHtml(offerText)}${cta()}${payNote}</div></div>
    </div>
  </div>
</header>

<main>
${showTesti ? `<section class="proof" aria-labelledby="proof-title">
  <div class="wrap center">
    ${t.testimonials_title ? `<h2 class="h2" id="proof-title">${e(t.testimonials_title)}</h2>` : ''}
  </div>
  ${tImgs.length ? `<div class="wrap wide"><div class="t-gallery${tImgs.length === 1 ? ' one' : ''}">${tImgs.map((u) => mediaTag(u, { alt: 'Depoimento de cliente', sizes: tImgs.length === 1 ? '(max-width: 600px) 100vw, 560px' : '(max-width: 760px) 100vw, 480px', extra: `data-full="${e(u)}"` })).join('')}</div></div>
  <div class="zoom" id="zoom" hidden role="dialog" aria-label="Depoimento ampliado"><button type="button" class="zoom-close" aria-label="Fechar">✕</button><img alt=""></div>` : ''}
  ${d.testimonials.length ? `<div class="wrap"><div class="t-list">${d.testimonials.map(testimonial).join('\n')}</div></div>` : ''}
</section>` : ''}

${t.intro || t.story ? `<section class="letter">
  <div class="wrap">
    <div class="prose">${rich(t.intro)}</div>
    ${fig(t.img1, t.img1_caption, 'tilt')}
    <div class="prose">${rich(t.story)}</div>
  </div>
</section>` : ''}

${t.mechanism ? `<section class="why">
  <div class="wrap">
    ${t.mechanism_title ? `<h2 class="h2">${e(t.mechanism_title)}</h2>` : ''}
    <div class="prose">${rich(t.mechanism)}</div>
    ${fig(t.img2, t.img2_caption, 'tilt')}
  </div>
</section>` : ''}

<section class="product">
  <div class="wrap">
    <p class="kicker">Apresentando</p>
    ${t.product_title ? `<h2 class="h2">${e(t.product_title)}</h2>` : ''}
    ${t.product_text ? `<p class="txt">${inline(t.product_text)}</p>` : ''}
    ${mediaTag(t.product_image, { alt: t.card_title || t.product_title, sizes: '(max-width: 680px) 100vw, 620px' })}
    <div class="buy">${cta()}${payNote}</div>
  </div>
</section>

${results.length ? `<section class="results">
  <div class="wrap wide">
    <div class="results-grid">
      ${mediaTag(t.results_image, { alt: 'Cachorro feliz e tranquilo', sizes: '(max-width: 860px) 100vw, 420px', widths: [640, 960], extra: 'width="720" height="720"' })}
      <div>
        ${t.results_title ? `<h2 class="h2">${e(t.results_title)}</h2>` : ''}
        <ul class="checks">${results.map((r) => `<li>${inline(r)}</li>`).join('')}</ul>
      </div>
    </div>
  </div>
</section>` : ''}

<section class="offer-sec" id="oferta" aria-labelledby="ficha-title">
  <div class="wrap">
    <article class="ficha" id="ficha">
      <div class="stamp">${STAMP}</div>
      <p class="ficha-tag">Ficha do guia</p>
      <h2 id="ficha-title">${e(t.card_title)}</h2>
      <dl class="meta">
        <div><dt>Rende</dt><dd>Um cão mais feliz</dd></div>
        <div><dt>Preparo</dt><dd>Poucos minutos</dd></div>
        <div><dt>Acesso</dt><dd>Imediato</dd></div>
      </dl>
      ${includes.length ? `<h3>Ingredientes <small>(o que você recebe)</small></h3>
      <ul class="leaders">${includes.map((x) => `<li><span class="it">${inline(x)}</span><i></i><b>✓ Incluso</b></li>`).join('')}</ul>` : ''}
      ${bonus.length ? `<h3>${e(t.bonus_title || 'Bônus')}</h3>
      <ul class="leaders">${bonus.map(([a, b]) => { const [em, name] = splitEmoji(a); return `<li class="bn"><span class="it">${em ? `<span class="em" aria-hidden="true">${em}</span>` : ''}${inline(name)}${b ? `<small>${inline(b)}</small>` : ''}</span><i></i><b>Bônus</b></li>`; }).join('')}</ul>` : ''}
      ${t.support_title ? `<div class="chat"><span class="ic" aria-hidden="true">💬</span><div><strong>${e(t.support_title)}</strong><span class="pill">EXCLUSIVO</span>${t.support_text ? `<p>${inline(t.support_text)}</p>` : ''}</div></div>` : ''}
      <div class="total">
        ${t.offer_intro ? `<p class="intro">${inline(t.offer_intro)}</p>` : ''}
        ${offerHtml(offerText)}
        ${cta()}
        ${payNote}
      </div>
    </article>
  </div>
</section>

${steps.length ? `<section class="receive">
  <div class="wrap wide">
    ${t.steps_title ? `<h2 class="h2 center">${e(t.steps_title)}</h2>` : ''}
    <ol class="steps">${steps.map(([a, b]) => `<li><strong>${inline(a)}</strong>${b ? `<span>${inline(b)}</span>` : ''}</li>`).join('')}</ol>
  </div>
</section>` : ''}

${t.guarantee_title || t.guarantee_text ? `<section class="guarantee">
  <div class="wrap">
    <div class="g-grid">
      ${STAMP}
      <div>
        ${t.guarantee_title ? `<h2 class="h2">${e(t.guarantee_title)}</h2>` : ''}
        ${t.guarantee_text ? `<p>${inline(t.guarantee_text)}</p>` : ''}
      </div>
    </div>
  </div>
</section>` : ''}

${faq.length ? `<section class="faq">
  <div class="wrap">
    ${t.faq_title ? `<h2 class="h2">${e(t.faq_title)}</h2>` : ''}
    ${faq.map(([q, a]) => `<details><summary>${e(q)}</summary><div class="ans">${inline(a)}</div></details>`).join('\n    ')}
  </div>
</section>` : ''}

<section class="ps" id="final">
  <div class="wrap">
    ${t.ps ? `<div class="prose">${rich(t.ps)}</div>` : ''}
    <div class="buy">${offerHtml(offerText)}${cta()}${payNote}</div>
  </div>
</section>
</main>

<footer>
  ${d.footer_text ? `<p>${e(d.footer_text)}</p>` : ''}
  ${d.disclaimer ? `<p>${e(d.disclaimer)}</p>` : ''}
</footer>

${ctaUrl ? `<div class="bar" id="bar" aria-hidden="true">
  ${newPrice ? `<div class="bp">${oldPrice ? `<s>${e(oldPrice)}</s>` : ''}<b>${e(newPrice)}</b></div>` : ''}
  ${cta('Quero agora', ' cta-sm').replace('<a ', '<a tabindex="-1" ')}
</div>` : ''}

${exitPopupHtml(d, { ctaUrl, offerText })}

<script>(function () {
  // Carimbo da garantia "bate" quando a ficha aparece.
  var ficha = document.getElementById('ficha');
  var io = 'IntersectionObserver' in window;
  if (ficha) {
    if (io) new IntersectionObserver(function (en, o) { if (en[0].isIntersecting) { ficha.classList.add('in'); o.disconnect(); } }, { threshold: .35 }).observe(ficha);
    else ficha.classList.add('in');
  }
  // Barra fixa: aparece quando o botão do topo sai da tela; some na oferta e no final.
  var bar = document.getElementById('bar');
  if (bar) {
    var els = ['hero-buy', 'ficha', 'final'].map(function (id) { return document.getElementById(id); });
    var inView = function (el) { if (!el) return false; var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
    var ticking = false, shown = false;
    var upd = function () {
      ticking = false;
      var hb = els[0] && els[0].getBoundingClientRect();
      var on = !!hb && hb.bottom < 0 && !inView(els[1]) && !inView(els[2]);
      if (on === shown) return;
      shown = on;
      bar.classList.toggle('on', on);
      bar.setAttribute('aria-hidden', on ? 'false' : 'true');
      var a = bar.querySelector('a'); if (a) a.tabIndex = on ? 0 : -1;
    };
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    addEventListener('resize', upd);
  }
  // Depoimentos: tocar abre em tela cheia.
  var z = document.getElementById('zoom');
  if (z) {
    var zi = z.querySelector('img');
    document.querySelectorAll('.t-gallery img').forEach(function (img) { img.addEventListener('click', function () { zi.src = img.getAttribute('data-full') || img.src; z.hidden = false; document.body.style.overflow = 'hidden'; }); });
    var close = function () { z.hidden = true; document.body.style.overflow = ''; };
    z.addEventListener('click', function (ev) { if (ev.target !== zi) close(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !z.hidden) close(); });
  }
})();</script>
<script>window.VSL_CFG = ${JSON.stringify(cfg).replace(/</g, '\\u003c')};</script>
<script>${PAGE_SCRIPT}</script>
</body>
</html>`;
}
