// HTML das páginas depois da compra (/upsell e /downsell). Uma coluna, rápida no
// celular, com o mesmo visual da página de vendas. O botão é o link do checkout
// ou o código de "compra com 1 clique" da plataforma de vendas.

import { e, pixelBase, isVideo } from './render.js';
import { pixelIds, parseVideoUrl } from './content.js';
import { rich } from './render-sales.js';

const inline = (s) => e(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/==(.+?)==/g, '<mark>$1</mark>');
const lines = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);
const pairs = (s) => lines(s).map((l) => { const i = l.indexOf('|'); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
const splitEmoji = (s) => { const m = s.match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u); return m ? [m[1], m[2]] : ['', s]; };

function priceParts(text) {
  const m = String(text || '').replace(/\s+/g, ' ').trim().match(/^de\s+(.+?)\s+por\s+(?:apenas\s+|só\s+)?(.+?)$/i);
  const money = (v) => (/^[\d.,\s]+$/.test(v) ? 'R$ ' + v.trim() : v.trim());
  return m ? [money(m[1]), money(m[2])] : ['', ''];
}

/** Vídeo ou imagem do topo, com os controles normais do navegador. */
function media(v) {
  if (v.type === 'upload' && v.file) {
    if (!isVideo(v.file)) return `<img src="${e(v.file)}" alt="" fetchpriority="high">`;
    return `<video src="${e(v.file)}" controls playsinline preload="metadata"${v.autoplay ? ' autoplay muted' : ''}></video>`;
  }
  if (v.type === 'embed' && v.embed.trim()) return `<div class="custom">${v.embed}</div>`;
  if (v.type === 'url') {
    const p = parseVideoUrl(v.url);
    if (p.kind === 'video') return `<video src="${e(p.src)}" controls playsinline preload="metadata"${v.autoplay ? ' autoplay muted' : ''}></video>`;
    if (p.kind === 'iframe') {
      let src = p.src.replace('controls=0', 'controls=1').replace('&disablekb=1', '').replace('&fs=0', '');
      if (v.autoplay && p.provider === 'youtube') src += '&autoplay=1&mute=1';
      if (v.autoplay && p.provider === 'vimeo') src += '&autoplay=1&muted=1';
      return `<iframe src="${e(src)}" title="Vídeo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    }
  }
  return '';
}

export function renderUpsell(d, page) {
  const t = d.upsells[page];
  const v = t.video;
  const mediaHtml = v.type === 'none' ? '' : media(v);
  const ratio = { '9:16': '9 / 16', '4:5': '4 / 5', '1:1': '1 / 1', '16:9': '16 / 9' }[v.ratio] || '9 / 16';
  const isEmbed = v.type === 'embed';
  const isImg = v.type === 'upload' && v.file && !isVideo(v.file);
  const [oldPrice, newPrice] = priceParts(t.offer_text);
  const pixels = pixelIds(`${d.meta_pixel_id},${process.env.META_PIXEL_ID || ''}`);
  const brandName = d.sales?.brand_name || d.brand_name;
  const logo = d.sales?.logo || d.logo;
  const favicon = d.sales?.favicon || d.favicon;
  const brand = logo ? `<img src="${e(logo)}" alt="${e(brandName)}">` : `<span>${e(brandName)}</span>`;
  const plainTitle = t.headline.replace(/==|\*\*/g, '');
  const problems = lines(t.problems);
  const includes = pairs(t.includes);
  const step2 = page === 'downsell' ? 'Última condição' : 'Oferta especial';

  // Botão: o código de 1 clique da plataforma (se houver) ou o link do checkout.
  let n = 0;
  const buy = () => {
    n++;
    const btn = t.cta_code.trim()
      ? `<div class="code">${t.cta_code}</div>`
      : t.cta_url
        ? `<a class="up-cta" href="${e(t.cta_url)}">${e(t.cta_text)}</a>`
        : '<p class="nolink">Adicione no painel o link do checkout ou o código de compra com 1 clique.</p>';
    const decline = t.decline_text && t.decline_url ? `<a class="decline" href="${e(t.decline_url)}">${e(t.decline_text)}</a>` : '';
    return `<div class="buy">
      ${oldPrice ? `<p class="price"><span class="old">${e(oldPrice)}</span><span class="new">${e(newPrice)}</span></p>` : t.offer_text ? `<p class="offer">${e(t.offer_text)}</p>` : ''}
      ${t.offer_note && n === 1 ? `<p class="onote">${inline(t.offer_note)}</p>` : ''}
      ${btn}
      ${t.pay_note ? `<p class="pay">${e(t.pay_note)}</p>` : ''}
      ${decline}
    </div>`;
  };

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>${e(plainTitle || brandName)}</title>
${favicon ? `<link rel="icon" href="${e(favicon)}">\n<link rel="apple-touch-icon" href="${e(favicon)}">` : ''}
<meta name="theme-color" content="#143627">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..112,400..900&family=Literata:opsz,wght@7..72,400..600&display=swap" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..112,400..900&family=Literata:opsz,wght@7..72,400..600&display=swap"></noscript>
<style>
  :root {
    --folha: #143627; --folha-2: #1d4a36; --folha-fundo: #0d261b;
    --salvia: #e6eedf; --papel: #fffdf7; --papel-borda: #ece4d0;
    --tinta: #1b221d; --tinta-2: #4b574e; --linha: #d3dccb;
    --cta: ${t.cta_color}; --luz: #ffb15c; --preco: #0e7a37; --risco: #d92d20; --carimbo: #b0391c;
    --display: 'Archivo', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    --carta: 'Literata', Georgia, 'Times New Roman', serif;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  html, body { max-width: 100%; overflow-x: hidden; }
  @supports (overflow: clip) { html, body { overflow-x: clip; } }
  body { margin: 0; background: var(--papel); color: var(--tinta); font: 400 17px/1.5 var(--display); -webkit-font-smoothing: antialiased; }
  img { max-width: 100%; height: auto; display: block; }
  .wrap { width: 100%; max-width: 640px; margin: 0 auto; padding: 0 20px; }

  /* Etapas: compra aprovada -> oferta -> acesso */
  .top { background: var(--folha); color: #dfeae2; padding: 16px 0 0; }
  .brand { display: flex; justify-content: center; font: 800 15px var(--display); color: #fff; margin-bottom: 14px; }
  .brand img { max-height: 30px; width: auto; }
  .steps { display: flex; list-style: none; margin: 0; padding: 0 0 16px; gap: 6px; font: 700 12px/1.2 var(--display); }
  .steps li { flex: 1; text-align: center; color: #9fb8a7; }
  .steps li::before { content: ""; display: block; height: 6px; margin-bottom: 7px; border-radius: 6px; background: rgba(255,255,255,.16); }
  .steps .done { color: #9be3b4; }
  .steps .done::before { background: #3fbf6e; }
  .steps .now { color: #fff; }
  .steps .now::before { background: linear-gradient(90deg, var(--luz) 55%, rgba(255,255,255,.16) 55%); }
  .alert { margin: 0; padding: 12px 16px; background: #fff3d6; color: #6b4300; border-bottom: 1px solid #f1d9a0; font-size: 15px; font-weight: 700; text-align: center; }

  /* Topo */
  .hero { padding: 30px 0 8px; text-align: center; }
  .tag { display: inline-block; margin: 0 0 12px; padding: 5px 12px; border-radius: 999px; background: #fde7d8; color: var(--carimbo); font: 800 12px/1.3 var(--display); letter-spacing: .08em; text-transform: uppercase; }
  h1 { margin: 0; font-weight: 800; font-stretch: 108%; font-size: clamp(27px, 7.4vw, 42px); line-height: 1.08; letter-spacing: -.02em; color: var(--folha); text-wrap: balance; }
  h1 mark { background: linear-gradient(transparent 58%, #ffd3a1 58%, #ffd3a1 94%, transparent 94%); color: inherit; padding: 0 .08em; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  .sub { margin: 16px auto 0; max-width: 560px; font-family: var(--carta); font-size: 18px; line-height: 1.6; color: var(--tinta-2); }
  .media { margin: 26px auto 0; max-width: ${v.ratio === '16:9' ? '640px' : '360px'}; border-radius: 20px; overflow: hidden; background: #000; box-shadow: 0 30px 50px -26px rgba(20,54,39,.6); }
  .media.frame { aspect-ratio: ${ratio}; }
  .media.img { background: none; max-width: 560px; }
  .media.custom { background: none; box-shadow: none; border-radius: 0; max-width: 100%; }
  .media video, .media iframe { display: block; width: 100%; height: 100%; border: 0; object-fit: cover; }

  section { padding: 30px 0; }
  .h2 { margin: 0 0 16px; font-weight: 800; font-stretch: 106%; font-size: clamp(23px, 6vw, 30px); line-height: 1.12; letter-spacing: -.015em; color: var(--folha); text-wrap: balance; }

  /* Dores */
  .pains { padding: 22px 20px; border-radius: 18px; background: var(--salvia); }
  .pains ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .pains li { position: relative; padding-left: 32px; font-size: 17px; line-height: 1.45; font-weight: 600; }
  .pains li::before { content: "✕"; position: absolute; left: 4px; top: 0; font-weight: 900; color: var(--risco); }

  /* O que recebe */
  .items { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .items li { display: flex; gap: 14px; align-items: flex-start; padding: 14px 16px; border-radius: 14px; background: #fff; border: 1.5px solid var(--papel-borda); }
  .items .em { flex: none; width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: var(--salvia); font-size: 22px; }
  .items .em.ck::before { content: "✓"; color: var(--preco); font-weight: 900; }
  .items b { display: block; font: 800 16.5px/1.3 var(--display); color: var(--folha); }
  .items span { display: block; margin-top: 2px; font-size: 15px; line-height: 1.45; color: var(--tinta-2); }

  /* Oferta */
  .deal { padding: 28px 20px 24px; border-radius: 22px; background: var(--folha); color: #e6efe8; text-align: center; box-shadow: 0 30px 60px -30px rgba(13,38,27,.8); }
  .buy { text-align: center; }
  .price { display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: 2px 12px; margin: 0 0 6px; font-weight: 700; }
  .price .old { position: relative; color: #f19a92; font-size: 20px; }
  .price .old::after { content: ""; position: absolute; left: -3px; right: -3px; top: 52%; height: 2px; background: currentColor; transform: rotate(-8deg); }
  .price .new { font-size: clamp(44px, 13vw, 58px); font-weight: 900; font-stretch: 104%; letter-spacing: -.025em; color: #8ff0b0; line-height: 1; }
  .offer { margin: 0 0 8px; font-size: 20px; font-weight: 800; }
  .onote { margin: 6px auto 18px; max-width: 420px; font-size: 14.5px; color: #c4d8ca; }
  .up-cta { display: block; width: 100%; max-width: 460px; margin: 0 auto; padding: 20px 18px; border-radius: 14px; background: var(--cta); color: #fff; text-decoration: none;
    font: 800 18px/1.15 var(--display); font-stretch: 106%; letter-spacing: .015em;
    box-shadow: 0 5px 0 color-mix(in srgb, var(--cta) 60%, #000), 0 16px 30px -12px rgba(0,0,0,.5); animation: pulse 2.4s ease-in-out infinite; }
  .up-cta:active { transform: translateY(4px); box-shadow: 0 1px 0 color-mix(in srgb, var(--cta) 60%, #000); }
  .up-cta:focus-visible { outline: 3px solid var(--luz); outline-offset: 4px; }
  @keyframes pulse { 50% { transform: scale(1.025); } }
  @media (prefers-reduced-motion: reduce) { .up-cta { animation: none; } }
  .code { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .pay { margin: 12px 0 0; font-size: 13px; color: #b9cfbf; }
  .pay::before { content: "🔒 "; }
  .decline { display: inline-block; margin-top: 18px; padding: 6px 4px; font-size: 14.5px; color: #b9cfbf; text-decoration: underline; text-underline-offset: 3px; }
  .light .pay, .light .decline { color: var(--tinta-2); }
  .light .price .old { color: var(--risco); }
  .light .price .new { color: var(--preco); }
  .light .onote { color: var(--tinta-2); }
  .nolink { padding: 14px; border: 2px dashed var(--luz); border-radius: 12px; color: var(--luz); font-weight: 700; }

  /* Garantia e P.S. */
  .g { display: flex; gap: 16px; align-items: center; padding: 18px; border-radius: 16px; border: 1.5px dashed #c9bea2; }
  .g .seal { flex: none; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; text-align: center; background: var(--carimbo); color: #fff; font: 900 22px/1 var(--display); }
  .g .seal small { display: block; font-size: 9.5px; letter-spacing: .1em; }
  .g strong { display: block; font: 800 17px/1.25 var(--display); color: var(--folha); }
  .g p { margin: 3px 0 0; font-size: 15px; line-height: 1.5; color: var(--tinta-2); }
  .ps { font-family: var(--carta); font-size: 17.5px; line-height: 1.65; }
  .ps p { margin: 0 0 1em; }
  .ps strong { font-weight: 600; color: #000; }
  .ps mark { background: #ffe1bd; color: inherit; }
  footer { margin-top: 20px; background: var(--folha-fundo); color: #8fa797; padding: 30px 20px 40px; font-size: 12.5px; text-align: center; }
  footer p { max-width: 640px; margin: 0 auto 8px; white-space: pre-line; }
</style>
${pixels.length ? pixelBase(pixels) : ''}
${d.head_code || ''}
</head>
<body>
<header class="top">
  <div class="wrap">
    <div class="brand">${brand}</div>
    <ol class="steps" aria-label="Etapas">
      <li class="done">Compra aprovada</li>
      <li class="now" aria-current="step">${step2}</li>
      <li>Seu acesso</li>
    </ol>
  </div>
</header>
${t.alert ? `<p class="alert">${e(t.alert)}</p>` : ''}

<main>
  <div class="wrap">
    <div class="hero">
      ${t.tag ? `<p class="tag">${e(t.tag)}</p>` : ''}
      <h1>${inline(t.headline)}</h1>
      ${t.subheadline ? `<p class="sub">${inline(t.subheadline)}</p>` : ''}
      ${mediaHtml ? `<div class="media${isEmbed ? ' custom' : isImg ? ' img' : ' frame'}">${mediaHtml}</div>` : ''}
    </div>

    ${problems.length ? `<section>
      <div class="pains">
        ${t.problems_title ? `<h2 class="h2">${e(t.problems_title)}</h2>` : ''}
        <ul>${problems.map((p) => `<li>${inline(p)}</li>`).join('')}</ul>
      </div>
    </section>` : ''}

    ${includes.length ? `<section>
      ${t.includes_title ? `<h2 class="h2">${e(t.includes_title)}</h2>` : ''}
      <ul class="items">${includes.map(([a, b]) => { const [em, title] = splitEmoji(a); return `<li><span class="em${em ? '' : ' ck'}" aria-hidden="true">${em}</span><div><b>${inline(title)}</b>${b ? `<span>${inline(b)}</span>` : ''}</div></li>`; }).join('')}</ul>
    </section>` : ''}

    <section id="oferta">
      <div class="deal">${buy()}</div>
    </section>

    ${t.guarantee_title || t.guarantee_text ? `<section>
      <div class="g"><div class="seal" aria-hidden="true">7<small>DIAS</small></div><div>${t.guarantee_title ? `<strong>${e(t.guarantee_title)}</strong>` : ''}${t.guarantee_text ? `<p>${e(t.guarantee_text)}</p>` : ''}</div></div>
    </section>` : ''}

    ${t.ps ? `<section class="ps">${rich(t.ps)}<div class="light">${buy()}</div></section>` : ''}
  </div>
</main>

<footer>
  ${d.footer_text ? `<p>${e(d.footer_text)}</p>` : ''}
  ${d.disclaimer ? `<p>${e(d.disclaimer)}</p>` : ''}
</footer>
<script>
// Leva os dados da compra (que a plataforma manda no endereço) para a próxima página,
// para a compra com 1 clique funcionar também no downsell.
(function () {
  var q = location.search;
  if (!q) return;
  document.querySelectorAll('a.decline').forEach(function (a) {
    try { var u = new URL(a.href); if (u.origin === location.origin && !u.search) { u.search = q; a.href = u.href; } } catch (e) {}
  });
})();
</script>
</body>
</html>`;
}
