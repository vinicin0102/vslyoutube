// HTML da página pública.

import { parseVideoUrl, pixelIds } from './content.js';
import { metricsConfigured } from './metrics.js';
import { tourHtml, promoHtml, extrasCss, TOUR_SCRIPT } from './extras.js';

export const e = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const RATIO_CSS = { '9:16': '9 / 16', '16:9': '16 / 9', '1:1': '1 / 1', '4:5': '4 / 5' };

/** HTML do player e como o script da página controla o vídeo. */
export function player(v) {
  const native = (src) => ({
    html: `<video id="vsl-video" src="${e(src)}" playsinline ${v.autoplay ? 'muted preload="auto"' : 'preload="metadata"'}></video>`,
    control: 'video',
  });
  if (v.type === 'upload' && v.file && !isVideo(v.file) && /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(v.file)) {
    return { html: `<img id="vsl-img" src="${e(v.file)}" alt="">`, control: 'none' };
  }
  if (v.type === 'upload' && v.file) return native(v.file);
  if (v.type === 'embed' && v.embed.trim()) {
    // Código do player (VTurb, Panda…) colado pelo administrador: não expõe o tempo do vídeo.
    return { html: v.embed, control: 'none' };
  }
  if (v.type === 'url') {
    const p = parseVideoUrl(v.url);
    if (p.kind === 'video') return native(p.src);
    if (p.kind === 'iframe') {
      if (v.autoplay && p.provider === 'youtube') p.src += '&autoplay=1&mute=1';
      if (v.autoplay && p.provider === 'vimeo') p.src += '&autoplay=1&muted=1';
      return {
        html: `<iframe id="vsl-frame" src="${e(p.src)}" title="Vídeo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`,
        control: p.provider || 'none',
      };
    }
  }
  return { html: '', control: 'none' };
}

export function testimonial(t) {
  const initial = (t.name || '?').trim().charAt(0).toUpperCase();
  const avatar = t.photo ? `<img src="${e(t.photo)}" alt="" loading="lazy">` : e(initial);
  const stars = t.rating > 0 ? `<span class="stars" aria-label="${t.rating} de 5 estrelas">${'★'.repeat(t.rating)}</span>` : '';
  const city = t.city ? `<span class="t-city">${e(t.city)}</span>` : '';
  const proof = t.proof ? (isVideo(t.proof) ? `<video class="t-photo" src="${e(t.proof)}#t=0.1" data-lazy muted loop playsinline preload="metadata"></video>` : `<img class="t-photo" src="${e(t.proof)}" alt="Imagem enviada por ${e(t.name)}" loading="lazy">`) : '';
  return `<article class="t">
      <div class="avatar" aria-hidden="true">${avatar}</div>
      <div class="t-body">
        <div class="t-meta"><span class="t-name">${e(t.name)}</span>${city}${stars}</div>
        <p class="t-text">${e(t.text)}</p>${proof}
      </div>
    </article>`;
}

// Imagens pela otimização da Vercel (WebP no tamanho da tela). No ambiente local
// a rota /_vercel/image não existe, então usa o arquivo original.
const OPT = Boolean(process.env.VERCEL);
const optimizable = (src) => /^\/media\/[\w.-]+\.(jpe?g|png)$/i.test(src) || /^https:\/\/iiem6jowmue3oprq\.public\.blob\.vercel-storage\.com\/vsl\/uploads\/[^?#]+\.(jpe?g|png|webp)$/i.test(src);
const vimg = (src, w, q = 75) => `/_vercel/image?url=${encodeURIComponent(src)}&w=${w}&q=${q}`;
/** Atributos src/srcset de uma imagem; se a versão otimizada falhar, volta para o original. */
export function imgAttrs(src, sizes = '(max-width: 640px) 100vw, 640px', widths = [640, 960, 1280]) {
  if (!OPT || !optimizable(src)) return `src="${e(src)}"`;
  return `src="${e(vimg(src, widths[1] || widths[0]))}" srcset="${widths.map((w) => `${e(vimg(src, w))} ${w}w`).join(', ')}" sizes="${sizes}" onerror="this.onerror=null;this.removeAttribute('srcset');this.src='${e(src)}'"`;
}

/** Arquivo de vídeo? (os campos de mídia do painel aceitam imagem ou vídeo) */
export const isVideo = (u) => /\.(mp4|webm)(\?|#|$)/i.test(String(u || ''));
/** <img> otimizada ou <video> sem som em loop, conforme o arquivo. */
export function mediaTag(src, { alt = '', cls = '', sizes, widths, extra = '' } = {}) {
  if (!src) return '';
  // Vídeo de enfeite/depoimento: só baixa e toca quando chega perto da tela (LAZY_VIDEO_SCRIPT),
  // para não disputar a internet com o vídeo principal quando a página abre.
  // #t=0.1 + preload="metadata": mostra o 1º quadro (no iPhone também) sem baixar o vídeo inteiro.
  if (isVideo(src)) return `<video class="${cls}" src="${e(src)}#t=0.1" data-lazy muted loop playsinline preload="metadata" aria-label="${e(alt)}" ${extra}></video>`;
  return `<img class="${cls}" ${imgAttrs(src, sizes, widths)} alt="${e(alt)}" loading="lazy" decoding="async" ${extra}>`;
}

export const LAZY_VIDEO_SCRIPT = `(function () {
  var vs = document.querySelectorAll('video[data-lazy]'); if (!vs.length) return;
  // Se o celular bloquear o play automático (economia de bateria, navegador do Instagram…), mostra os controles.
  var go = function (v) { v.preload = 'auto'; var p = v.play(); if (p && p.catch) p.catch(function () { v.controls = true; }); };
  if (!('IntersectionObserver' in window)) { vs.forEach(go); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (en) {
    var v = en.target;
    if (en.isIntersecting) go(v); else if (!v.controls) v.pause();
  }); }, { rootMargin: '250px 0px' });
  vs.forEach(function (v) { io.observe(v); });
})();`;

// "de 289 por 27,90" vira preço antigo riscado em vermelho + preço novo em destaque.
export const money = (v) => (/^[\d.,\s]+$/.test(v) ? 'R$ ' + v.trim() : v.trim());
export function offerHtml(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  // Aspas digitadas junto (ex.: de"289 por 27,90") são ignoradas.
  const m = t.replace(/["“”'‘’]/g, ' ').replace(/\s+/g, ' ').trim().match(/^de\s+(.+?)\s+por\s+(?:apenas\s+|só\s+)?(.+?)$/i);
  if (!m) return `<p class="offer">${e(t)}</p>`;
  return `<p class="price" aria-label="De ${e(money(m[1]))} por ${e(money(m[2]))}">`
    + `<span class="lbl">de</span><span class="old"><s style="text-decoration:none">${e(money(m[1]))}</s></span>`
    + `<span class="lbl">por</span><span class="new">${e(money(m[2]))}</span></p>`;
}

export function pixelBase(ids) {
  // Vários pixels: cada evento enviado depois do init vai para todos eles.
  return `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
${ids.map((id) => `fbq('init', '${id}');`).join('\n')}
fbq('track', 'PageView');
</script>
<noscript>${ids.map((id) => `<img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1">`).join('')}</noscript>`;
}

/** "R$ 27,90" -> 27.9 (para o valor do InitiateCheckout). */
export function priceValue(text) {
  const m = String(text || '').match(/por\s+(?:apenas\s+|só\s+)?(?:R\$\s*)?([\d.]*\d(?:,\d{1,2})?)/i);
  if (!m) return 0;
  return Number(m[1].replace(/\./g, '').replace(',', '.')) || 0;
}

/** Pop-up de saída (o script fica no PAGE_SCRIPT). */
export function exitPopupHtml(d, opts = {}) {
  const x = d.exit_popup;
  const url = x.url || opts.ctaUrl || d.cta.url;
  if (!x.enabled || !url) return '';
  const offer = x.offer_text || opts.offerText || d.cta.offer_text;
  return `<div class="exitpop" id="exitpop" hidden role="dialog" aria-modal="true" aria-labelledby="ex-title" data-delay="${x.delay}">
  <div class="card" tabindex="-1">
    <button type="button" class="x" aria-label="Fechar">✕</button>
    ${x.tag ? `<span class="etag">${e(x.tag)}</span>` : ''}
    ${x.title ? `<h2 id="ex-title">${e(x.title)}</h2>` : ''}
    ${x.text ? `<p class="etext">${e(x.text)}</p>` : ''}
    ${x.image ? (isVideo(x.image) ? `<video class="eimg" src="${e(x.image)}" autoplay muted loop playsinline preload="metadata"></video>` : `<img class="eimg" src="${e(x.image)}" alt="">`) : ''}
    ${offerHtml(offer)}
    <a class="cta" href="${e(url)}" data-price="${priceValue(offer) || ''}">${e(x.button || 'QUERO APROVEITAR')}</a>
    ${x.note ? `<p class="enote">${e(x.note)}</p>` : ''}
    <button type="button" class="nothanks">Não, obrigado</button>
  </div>
</div>`;
}

export function renderPage(d) {
  const v = d.video;
  const cta = d.cta;
  const wide = v.ratio === '16:9';
  const { html, control } = player(v);
  const custom = v.type === 'embed' && html;
  const showCta = cta.enabled && cta.url && cta.text.trim();
  const pitch = cta.delay;
  const gated = pitch > 0; // há algo esperando o momento do pitch
  const hideBelow = gated && cta.hide_below;
  const pauseImg = v.pause_image && control !== 'none' ? v.pause_image : '';
  const pitchAttr = (on) => (on ? ' data-pitch hidden' : '');
  const track = metricsConfigured();
  const needsScript = true; // player, pitch, métricas e eventos do pixel
  const pixels = pixelIds(`${d.meta_pixel_id},${process.env.META_PIXEL_ID || ''}`);
  const pixel = pixels.length > 0;
  const autoplay = Boolean(v.autoplay) && control !== 'none';
  const cfg = { pitch, control, pause: Boolean(pauseImg), track, e: d.metrics_epoch, px: Boolean(pixel), price: priceValue(cta.offer_text), autoplay };

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(d.title || d.brand_name)}</title>
${d.favicon ? `<link rel="icon" href="${e(d.favicon)}">\n<link rel="apple-touch-icon" href="${e(d.favicon)}">` : ''}
<meta name="description" content="${e(d.subtitle)}">
<meta name="theme-color" content="#0f0f0f">
<style>
  :root { --bg:#0f0f0f; --surface:#1a1a1a; --line:#272727; --text:#f1f1f1; --muted:#aaaaaa; --cta:${cta.color}; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text); max-width: 100%; overflow-x: hidden; }
  @supports (overflow: clip) { html, body { overflow-x: clip; } }
  body { font-family: Roboto, "Segoe UI", system-ui, -apple-system, Arial, sans-serif; font-size: 15px; line-height: 1.45; -webkit-font-smoothing: antialiased; }
  img { max-width: 100%; display: block; }
  .topbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: center; height: 60px; padding: 0 16px; background: var(--bg); border-bottom: 1px solid var(--line); }
  .topbar img { max-height: 36px; width: auto; }
  .topbar .brand { font-weight: 700; font-size: 18px; letter-spacing: -.01em; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
  .head { text-align: center; }
  .badge { display: inline-block; margin-bottom: 12px; padding: 4px 10px; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #ff6b6b; background: rgba(255,70,70,.1); border: 1px solid rgba(255,70,70,.35); border-radius: 4px; }
  h1 { margin: 0 0 6px; font-size: clamp(19px, 4.6vw, 24px); line-height: 1.25; font-weight: 700; }
  .sub { margin: 0; color: var(--muted); font-size: 13px; }
  .player { margin: 20px auto 0; width: 100%; max-width: ${wide ? '760px' : '380px'}; aspect-ratio: ${RATIO_CSS[v.ratio] || '9 / 16'}; background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.6); }
  .player iframe, .player video, .player #vsl-img { width: 100%; height: 100%; border: 0; display: block; object-fit: cover; background: #000; }
  .player.custom { aspect-ratio: auto; background: none; box-shadow: none; }
  .player { position: relative; }
  .pause-overlay { position: absolute; inset: -1px; z-index: 2; display: block; width: calc(100% + 2px); height: calc(100% + 2px); padding: 0; border: 0; background: #000; cursor: pointer; }
  .pause-overlay[hidden] { display: none; }
  .pause-overlay img, .pause-overlay video { width: 100%; height: 100%; object-fit: contain; display: block; background: #000; }
  .play-cover { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; width: 100%; height: 100%; padding: 0; border: 0; cursor: pointer;
    background: radial-gradient(circle at center, rgba(0,0,0,.15), rgba(0,0,0,.45)); }
  .play-cover[hidden], .tap-layer[hidden] { display: none; }
  .play-cover .pc { width: 88px; height: 88px; border-radius: 50%; background: var(--cta); display: grid; place-items: center;
    box-shadow: 0 8px 30px rgba(0,0,0,.5), 0 0 0 10px color-mix(in srgb, var(--cta) 30%, transparent); animation: pcpulse 1.6s ease-in-out infinite; }
  .play-cover .pc::after { content: ""; margin-left: 7px; border-left: 30px solid #fff; border-top: 19px solid transparent; border-bottom: 19px solid transparent; }
  @keyframes pcpulse { 50% { transform: scale(1.07); } }
  @media (prefers-reduced-motion: reduce) { .play-cover .pc { animation: none; } }
  .play-cover:focus-visible .pc { outline: 3px solid #fff; outline-offset: 4px; }
  .tap-layer { position: absolute; inset: 0; z-index: 1; cursor: pointer; }
  /* Autoplay sem som: aviso por cima do vídeo até a pessoa ativar o som. */
  .unmute { position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; width: 100%; height: 100%; padding: 16px; border: 0;
    background: rgba(0,0,0,.28); cursor: pointer; font: inherit; color: #fff; }
  .unmute[hidden] { display: none; }
  .unmute .box { display: grid; justify-items: center; gap: 6px; max-width: 260px; padding: 18px 20px; border-radius: 16px; background: var(--cta);
    box-shadow: 0 10px 30px rgba(0,0,0,.45); animation: pcpulse 1.6s ease-in-out infinite; text-align: center; }
  .unmute .ico { font-size: 40px; line-height: 1; }
  .unmute b { font-size: 18px; line-height: 1.2; }
  .unmute span { font-size: 14px; opacity: .95; }
  @media (prefers-reduced-motion: reduce) { .unmute .box { animation: none; } }
  .unmute:focus-visible .box { outline: 3px solid #fff; outline-offset: 4px; }
  .pause-overlay:focus-visible { outline: 3px solid #fff; outline-offset: -3px; }
  .offer { margin: 0 0 12px; font-size: 16px; font-weight: 700; white-space: pre-line; }
  .price { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: center; gap: 4px 12px; margin: 0 0 14px; font-weight: 700; }
  .price .lbl { font-size: 15px; color: var(--muted); font-weight: 600; }
  /* Preço antigo em vermelho, cortado por um X. */
  .price .old { position: relative; display: inline-block; color: #ef4444; font-size: 20px; padding: 0 4px; }
  .price .old::before, .price .old::after { content: ""; position: absolute; left: -2px; right: -2px; top: 50%; height: 2px; background: #ef4444; border-radius: 2px; }
  .price .old::before { transform: rotate(18deg); }
  .price .old::after { transform: rotate(-18deg); }
  .price .new { font-size: 30px; font-weight: 800; color: #14d721; letter-spacing: -.01em; }
  [data-pitch][hidden] { display: none; }
  /* Pop-up de saída */
  .exitpop { position: fixed; inset: 0; z-index: 300; display: grid; place-items: center; padding: 18px; background: rgba(0,0,0,.78);
    animation: exfade .25s ease-out; }
  .exitpop[hidden] { display: none; }
  @keyframes exfade { from { opacity: 0; } }
  .exitpop .card { position: relative; width: 100%; max-width: 420px; max-height: calc(100vh - 36px); overflow: auto; padding: 26px 22px 20px; border-radius: 20px;
    background: #141414; border: 2px solid var(--cta); text-align: center; box-shadow: 0 24px 60px rgba(0,0,0,.6); animation: expop .35s cubic-bezier(.2,.9,.2,1.25); }
  @keyframes expop { from { transform: scale(.85); opacity: 0; } }
  .exitpop .card:focus { outline: none; }
  .exitpop .x { position: absolute; top: 8px; right: 8px; width: 40px; height: 40px; border: 0; border-radius: 50%; background: rgba(255,255,255,.08);
    color: #ddd; font-size: 20px; cursor: pointer; }
  .exitpop .etag { display: inline-block; padding: 5px 12px; border-radius: 6px; background: #dc2626; color: #fff; font-size: 13px; font-weight: 900; letter-spacing: .08em; }
  .exitpop h2 { margin: 12px 0 8px; font-size: 25px; line-height: 1.2; color: #fff; }
  .exitpop p.etext { margin: 0 0 12px; color: #d4d4d4; font-size: 16px; line-height: 1.5; }
  .exitpop img.eimg { width: 100%; max-height: 220px; object-fit: contain; margin: 4px 0 10px; }
  .exitpop .cta { margin-top: 6px; }
  .exitpop .enote { margin: 12px 0 0; font-size: 13px; color: #a3a3a3; }
  .exitpop .nothanks { margin-top: 10px; background: none; border: 0; color: #8a8a8a; font-size: 13px; text-decoration: underline; cursor: pointer; }
  [data-pitch].reveal { animation: fadein .5s ease-out both; }
  .player-empty { height: 100%; display: grid; place-items: center; padding: 24px; text-align: center; color: var(--muted); font-size: 14px; background: var(--surface); }
  .cta-wrap { text-align: center; margin: 24px auto 0; max-width: 520px; }
  .cta-wrap[hidden] { display: none; }
  .cta { display: block; width: 100%; padding: 18px 20px; border-radius: 10px; background: var(--cta); color: #fff; text-decoration: none; font-weight: 800; font-size: 17px; letter-spacing: .01em; box-shadow: 0 6px 24px color-mix(in srgb, var(--cta) 45%, transparent); animation: pulse 1.8s ease-in-out infinite; }
  .cta:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
  @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }
  @media (prefers-reduced-motion: reduce) { .cta { animation: none; } }
  @keyframes fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .testimonials { max-width: 760px; margin: 48px auto 0; }
  .testimonials h2 { margin: 0 0 20px; font-size: 19px; font-weight: 700; }
  /* Cada imagem ocupa a largura toda da coluna, sem moldura. */
  /* Imagens de depoimento maiores que a coluna de texto: até 960px no computador
     e de ponta a ponta no celular. Tocar abre em tela cheia. */
  .t-gallery { position: relative; left: 50%; transform: translateX(-50%); width: min(960px, calc(100vw - 48px)); margin-bottom: 8px; }
  .t-gallery img, .t-gallery video { display: block; width: 100%; height: auto; margin: 0 0 14px; cursor: zoom-in; }
  .t-gallery video { cursor: default; }
  @media (max-width: 600px) {
    .t-gallery { width: 100vw; }
    .t-gallery img { margin-bottom: 10px; }
  }
  .zoom { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,.94); overflow: auto; -webkit-overflow-scrolling: touch; display: flex; }
  .zoom[hidden] { display: none; }
  .zoom img { flex: 0 0 auto; margin: auto; max-width: none; width: auto; height: auto; min-width: 100%; }
  @media (min-width: 601px) { .zoom img { min-width: 0; max-width: 100%; } }
  .zoom-close { position: fixed; top: 12px; right: 12px; z-index: 201; width: 44px; height: 44px; border-radius: 50%; border: 0;
    background: rgba(255,255,255,.15); color: #fff; font-size: 22px; line-height: 44px; cursor: pointer; }
  .testimonials h2 span { color: var(--muted); font-weight: 400; font-size: 15px; margin-left: 6px; }
  .t { display: flex; gap: 14px; padding: 14px 0; border-top: 1px solid var(--line); }
  .t:first-of-type { border-top: 0; }
  .avatar { flex: 0 0 40px; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: #3a3a3a; color: #fff; font-weight: 700; font-size: 16px; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .t-body { min-width: 0; }
  .t-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; margin-bottom: 3px; }
  .t-name { font-weight: 600; font-size: 14px; }
  .t-city { color: var(--muted); font-size: 12px; }
  .stars { color: #fbbf24; font-size: 12px; letter-spacing: 1px; }
  .t-text { margin: 0; font-size: 14px; white-space: pre-line; overflow-wrap: anywhere; }
  .t-photo { margin-top: 10px; max-width: 280px; border-radius: 8px; }
  footer { border-top: 1px solid var(--line); margin-top: 32px; padding: 24px 16px 40px; color: #717171; font-size: 12px; text-align: center; }
  footer p { max-width: 680px; margin: 0 auto 8px; white-space: pre-line; }
${extrasCss('vsl')}
</style>
${pixel ? pixelBase(pixels) : ''}
${d.head_code}
</head>
<body>
<header class="topbar">
  ${d.logo ? `<img src="${e(d.logo)}" alt="${e(d.brand_name)}">` : `<span class="brand">${e(d.brand_name)}</span>`}
</header>
<main>
  <div class="head">
    ${d.badge.trim() ? `<div class="badge">${e(d.badge)}</div>` : ''}
    <h1>${e(d.title)}</h1>
    ${d.subtitle.trim() ? `<p class="sub">${e(d.subtitle)}</p>` : ''}
  </div>
  <div class="player${custom ? ' custom' : ''}">
    ${html || '<div class="player-empty">Nenhum vídeo configurado.<br>Adicione o vídeo pelo painel.</div>'}
    ${control !== 'none' ? '<div class="tap-layer" id="vsl-tap" hidden></div><button type="button" class="play-cover" id="vsl-play" aria-label="Assistir ao vídeo"><span class="pc"></span></button>' : ''}
    ${autoplay ? '<button type="button" class="unmute" id="vsl-unmute" hidden aria-label="Ativar o som do vídeo"><span class="box"><span class="ico">🔊</span><b>Seu vídeo já começou</b><span>Toque para ouvir</span></span></button>' : ''}
    ${pauseImg ? `<button type="button" class="pause-overlay" id="vsl-pause" hidden aria-label="Continuar assistindo">${/\.(mp4|webm)(\?|$)/i.test(pauseImg) ? `<video src="${e(pauseImg)}" muted loop playsinline preload="metadata"></video>` : `<img src="${e(pauseImg)}" alt="">`}</button>` : ''}
  </div>
  ${
    showCta
      ? `<div class="cta-wrap"${pitchAttr(gated)}>
    ${offerHtml(cta.offer_text)}
    ${promoHtml(d)}
    <a class="cta" href="${e(cta.url)}">${e(cta.text)}</a>
  </div>`
      : ''
  }
  ${tourHtml(d, 'vsl', pitchAttr(gated))}
  ${
    d.testimonials.length || d.testimonial_images.length
      ? `<section class="testimonials" aria-labelledby="t-title"${pitchAttr(hideBelow)}>
    ${d.testimonials_title.trim() ? `<h2 id="t-title">${e(d.testimonials_title)}${d.testimonials.length && !d.testimonial_images.length ? `<span>${d.testimonials.length}</span>` : ''}</h2>` : ''}
    ${d.testimonial_images.length ? `<div class="t-gallery">${d.testimonial_images.map((u) => mediaTag(u, { alt: 'Depoimento de cliente', sizes: '(max-width: 600px) 100vw, 960px', widths: [640, 960, 1280], extra: `data-full="${e(u)}"` })).join('')}</div>
    <div class="zoom" id="zoom" hidden role="dialog" aria-label="Depoimento ampliado"><button type="button" class="zoom-close" aria-label="Fechar">✕</button><img alt=""></div>
    <script>(function () {
      var z = document.getElementById('zoom'), zi = z.querySelector('img');
      document.querySelectorAll('.t-gallery img').forEach(function (img) {
        img.addEventListener('click', function () { zi.src = img.getAttribute('data-full') || img.src; z.hidden = false; document.body.style.overflow = 'hidden'; });
      });
      function close() { z.hidden = true; document.body.style.overflow = ''; }
      z.addEventListener('click', function (ev) { if (ev.target !== zi) close(); });
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !z.hidden) close(); });
    })();</script>` : ''}
    ${d.testimonials.map(testimonial).join('\n    ')}
  </section>`
      : ''
  }
</main>
${exitPopupHtml(d)}
${
  d.footer_text.trim() || d.disclaimer.trim()
    ? `<footer${pitchAttr(hideBelow)}>
  ${d.footer_text.trim() ? `<p>${e(d.footer_text)}</p>` : ''}
  ${d.disclaimer.trim() ? `<p>${e(d.disclaimer)}</p>` : ''}
</footer>`
    : ''
}
<script>${LAZY_VIDEO_SCRIPT}</script>
${d.tour?.on_vsl && d.tour?.video ? `<script>${TOUR_SCRIPT}</script>\n` : ''}${needsScript ? `<script>window.VSL_CFG = ${JSON.stringify(cfg)};</script>\n<script>${PAGE_SCRIPT}</script>` : ''}
</body>
</html>`;
}

// Controla o vídeo na página: revela a oferta no momento do pitch e mostra a
// imagem de pausa. Funciona com vídeo próprio (MP4), YouTube e Vimeo; com
// código de player externo, o pitch conta o tempo de página aberta.
export const PAGE_SCRIPT = `(function () {
  var cfg = window.VSL_CFG, KEY = 'vsl_pitch_' + cfg.pitch, done = false;
  var overlay = document.getElementById('vsl-pause');
  var ovVideo = overlay && overlay.querySelector('video');
  var player = { play: function () {}, pause: function () {}, unmute: function () {} };
  var cover = document.getElementById('vsl-play');
  var tap = document.getElementById('vsl-tap');
  var started = false, wantPlay = false;
  // Autoplay sem som: enquanto "muted" for true o vídeo é só vitrine —
  // não conta play, tempo, pitch nem eventos do pixel.
  var unmuteBtn = document.getElementById('vsl-unmute');
  var muted = false;

  /* ---- métricas: estado da visita, reenviado inteiro a cada mudança ---- */
  var qs = new URLSearchParams(location.search);
  var T = null;
  if (cfg.track && !qs.has('v') && !qs.has('notrack') && !qs.has('teste')) {
    var rid = function () { var a = new Uint8Array(8); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); };
    var uid; try { uid = localStorage.getItem('vsl_uid'); if (!uid) { uid = rid(); localStorage.setItem('vsl_uid', uid); } } catch (e) { uid = rid(); }
    var ref = ''; try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\\./, '') : ''; } catch (e) {}
    if (ref === location.hostname) ref = '';
    T = { s: rid(), u: uid, t0: Date.now(), e: cfg.e,
      dv: matchMedia('(pointer: coarse)').matches || innerWidth < 768 ? 'm' : 'd',
      src: qs.get('utm_source') || ref || 'direto', p: 0, m: 0, d: 0, h: 0, c: 0, pg: cfg.page || 'vsl' };
  }
  /* ---- Meta Pixel: cada evento uma vez por visita (a prévia do painel não dispara) ---- */
  var sent = {};
  function px(kind, name, params, key, opts) {
    key = key || name;
    if (!cfg.px || qs.has('nopixel') || sent[key] || typeof fbq !== 'function') return;
    sent[key] = 1;
    if (opts) fbq(kind, name, params || {}, opts); else fbq(kind, name, params || {});
  }
  function cookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  // Clique no botão (todo clique): dispara InitiateCheckout e espera um instante antes de ir ao checkout,
  // para o evento não se perder na troca de página.
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a.cta');
    if (!a) return;
    var val = a.getAttribute('data-price') ? Number(a.getAttribute('data-price')) : cfg.price;
    var params = val > 0 ? { value: val, currency: 'BRL' } : {};
    sent.InitiateCheckout = 1; // só marca que clicou (o pop-up de saída não aparece mais)
    if (qs.has('nopixel')) return;
    // Todo clique no botão conta como um InitiateCheckout (cada um com o seu eventID).
    // O mesmo evento vai pelo navegador (pixel) e pelo servidor (API de Conversões);
    // o eventID igual faz o Meta contar uma vez só. Pelo servidor ele chega mesmo com bloqueador.
    var eid = 'ic-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    var fbc = cookie('_fbc'); var fbclid = qs.get('fbclid');
    if (!fbc && fbclid) fbc = 'fb.1.' + Date.now() + '.' + fbclid;
    var srv = JSON.stringify({ k: 'ic', id: eid, v: val || 0, u: location.href, fbp: cookie('_fbp'), fbc: fbc });
    if (!(navigator.sendBeacon && navigator.sendBeacon('/api/t', new Blob([srv], { type: 'text/plain' })))) {
      fetch('/api/t', { method: 'POST', body: srv, keepalive: true }).catch(function () {});
    }
    if (cfg.px && typeof fbq === 'function') {
      fbq('track', 'InitiateCheckout', params, { eventID: eid });
      // Abrindo na mesma aba: espera o pixel sair antes de trocar de página.
      if (!(ev.ctrlKey || ev.metaKey || ev.shiftKey) && a.target !== '_blank') {
        ev.preventDefault();
        setTimeout(function () { location.href = a.href; }, 350);
      }
    }
  });
  var lastPct = 0;

  var dirty = false;
  function flush(first) {
    if (!T || (!dirty && !first)) return;
    dirty = false;
    var body = JSON.stringify(first ? Object.assign({ n: 1 }, T) : T);
    if (!(navigator.sendBeacon && navigator.sendBeacon('/api/t', new Blob([body], { type: 'text/plain' })))) {
      fetch('/api/t', { method: 'POST', body: body, keepalive: true }).catch(function () {});
    }
  }
  function mark(k, v) { if (T && T[k] !== v) { T[k] = v; dirty = true; } }
  if (T) {
    flush(true);
    setInterval(function () { flush(); }, 15000);
    addEventListener('pagehide', function () { flush(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
    document.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('.cta')) { mark('c', 1); flush(); }
    }, true);
  }

  /* ---- Pop-up de saída: uma vez por visitante, depois de X segundos ---- */
  var exPop = document.getElementById('exitpop');
  if (exPop) {
    var exArmed = false, exShown = false, exKey = 'vsl_exit_seen';
    var exTest = qs.has('teste');
    try { if (!exTest && localStorage.getItem(exKey) === '1') exShown = true; } catch (e) {}
    setTimeout(function () { exArmed = true; }, exTest ? 0 : (Number(exPop.getAttribute('data-delay')) || 0) * 1000);
    var openExit = function (why) {
      if (!exArmed || exShown || sent.InitiateCheckout || (T && T.c)) return;
      exShown = true;
      try { if (!exTest) localStorage.setItem(exKey, '1'); } catch (e) {}
      exPop.hidden = false;
      px('trackCustom', 'ExitPopup', { trigger: why });
      var card = exPop.querySelector('.card'); if (card) card.focus({ preventScroll: true });
    };
    var closeExit = function () { exPop.hidden = true; };
    exPop.addEventListener('click', function (ev) { if (ev.target === exPop || ev.target.closest('.x, .nothanks')) closeExit(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !exPop.hidden) closeExit(); });
    // Computador: o mouse sai pela parte de cima (fechar aba, barra de endereço).
    document.addEventListener('mouseout', function (ev) { if (!ev.relatedTarget && ev.clientY <= 0) openExit('mouse'); });
    // Celular: subida rápida em direção ao topo, depois de ter descido na página.
    var lastY = scrollY, lastT = Date.now(), maxY = 0;
    addEventListener('scroll', function () {
      var y = scrollY, now = Date.now();
      maxY = Math.max(maxY, y);
      if (maxY > 500 && y < 250 && lastY - y > 140 && now - lastT < 350) openExit('scroll');
      if (now - lastT > 120) { lastY = y; lastT = now; }
    }, { passive: true });
    // Celular: saiu do app/aba e voltou.
    var hiddenAt = 0;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 3000) openExit('voltou');
    });
  }

  // Página de vendas: "chegou na oferta" quando a seção da oferta aparece na tela.
  if (cfg.reach && 'IntersectionObserver' in window) {
    var reachEl = document.querySelector(cfg.reach);
    if (reachEl) {
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        if (T && !T.h) { mark('h', 1); flush(); }
        px('track', 'ViewContent', { content_name: 'Oferta da página de vendas' });
        px('trackCustom', 'Pitch');
      }, { threshold: 0.25 });
      io.observe(reachEl);
    }
  }
  function reveal() {
    if (done) return; done = true;
    document.querySelectorAll('[data-pitch]').forEach(function (el) { el.hidden = false; el.classList.add('reveal'); });
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
  }
  function time(t, dur) {
    if (muted) return;
    if (cfg.pitch > 0 && t >= cfg.pitch) {
      reveal();
      if (T && !T.h) { mark('h', 1); flush(); }
      px('track', 'ViewContent', { content_name: 'Pitch da VSL' });
      px('trackCustom', 'Pitch');
    }
    if (dur > 0 && isFinite(dur)) {
      [25, 50, 75].forEach(function (p) {
        if (t >= dur * p / 100 && t <= lastPct + 5) px('trackCustom', 'VideoProgress', { percent: p }, 'VP' + p);
      });
    }
    lastPct = Math.max(lastPct, t);
    if (dbg) debugTick(t, dur);
    if (!T) return;
    if (dur > 0 && isFinite(dur)) T.d = Math.round(dur);
    // Só conta tempo assistido em sequência: pular para a frente não infla a retenção.
    if (t <= T.m + 3 && Math.floor(t) > T.m) { T.m = Math.floor(t); dirty = true; }
  }
  // Sem controles: botão grande de play; tocar no vídeo pausa; na pausa aparece a imagem.
  function paused() {
    if (muted) return;
    if (tap) tap.hidden = true;
    if (overlay) {
      overlay.hidden = false;
      if (ovVideo) { ovVideo.currentTime = 0; ovVideo.play().catch(function () {}); }
    } else if (cover) cover.hidden = false;
    flush();
  }
  function playing() {
    if (cover) cover.hidden = true;
    if (muted) { if (unmuteBtn) unmuteBtn.hidden = false; return; }
    started = true;
    px('trackCustom', 'VideoPlay');
    if (cover) cover.hidden = true;
    if (tap) tap.hidden = false;
    if (overlay) overlay.hidden = true;
    if (ovVideo) ovVideo.pause();
    if (T && !T.p) { mark('p', 1); flush(); }
  }
  // Se o player externo não começar (celular bloqueia o play vindo de fora),
  // libera o toque direto no vídeo.
  function letNativeTap() { if (cover) cover.hidden = true; if (overlay) overlay.hidden = true; if (tap) tap.hidden = true; }
  function resume() {
    wantPlay = true;
    if (cover) cover.hidden = true;
    if (overlay) overlay.hidden = true;
    player.play();
    if (cfg.control !== 'video') setTimeout(function () { if (!started || (tap && tap.hidden)) letNativeTap(); }, 2500);
  }
  if (cover) cover.addEventListener('click', resume);
  if (overlay) overlay.addEventListener('click', resume);
  if (tap) tap.addEventListener('click', function () { player.pause(); });
  // Ativar o som: volta ao início com som e passa a contar como play de verdade.
  function unmute() {
    if (!muted) return;
    muted = false;
    if (unmuteBtn) unmuteBtn.hidden = true;
    player.unmute();
    playing();
  }
  if (unmuteBtn) unmuteBtn.addEventListener('click', unmute);

  // Prévia do painel (?v=) e modo de teste (?teste) ignoram a memória de quem já viu a oferta.
  var preview = qs.has('v') || qs.has('teste');
  if (cfg.pitch <= 0) reveal();
  try { if (!preview && localStorage.getItem(KEY) === '1') reveal(); } catch (e) {}

  // Modo de teste: mostra o tempo do vídeo e quanto falta para o pitch.
  var dbg = null;
  if (qs.has('teste')) {
    dbg = document.createElement('div');
    dbg.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;padding:8px 12px;border-radius:8px;background:rgba(0,0,0,.85);color:#fff;font:600 13px/1.4 system-ui,sans-serif;border:1px solid #444';
    document.body.appendChild(dbg);
  }
  function fmt(x) { x = Math.max(0, Math.floor(x)); return Math.floor(x / 60) + ':' + ('0' + (x % 60)).slice(-2); }
  function debugTick(t, dur) {
    if (!dbg) return;
    var txt = 'Vídeo: ' + fmt(t) + (dur > 0 && isFinite(dur) ? ' / ' + fmt(dur) : '') + ' · Pitch: ' + (cfg.pitch > 0 ? fmt(cfg.pitch) : 'desde o início');
    if (cfg.pitch > 0) txt += done ? ' · ✅ oferta visível' : ' · faltam ' + fmt(cfg.pitch - t);
    if (cfg.pitch > 0 && dur > 0 && isFinite(dur) && dur < cfg.pitch) txt += ' · ⚠️ o vídeo é mais curto que o pitch!';
    dbg.textContent = txt;
  }
  if (dbg) debugTick(0, 0);
  function fallbackTimer() { if (cfg.pitch > 0) setTimeout(reveal, cfg.pitch * 1000); }

  if (cfg.control === 'video') {
    var v = document.getElementById('vsl-video');
    player.play = function () { v.play(); };
    player.pause = function () { v.pause(); };
    player.unmute = function () { v.currentTime = 0; v.muted = false; v.play().catch(function () {}); };
    if (cfg.autoplay) {
      muted = true;
      v.muted = true;
      // Se o navegador bloquear o autoplay (ex.: modo economia de bateria), fica o botão de play.
      v.play().catch(function () { muted = false; v.muted = false; if (unmuteBtn) unmuteBtn.hidden = true; if (cover) cover.hidden = false; });
    }
    v.addEventListener('ended', function () { if (tap) tap.hidden = true; if (cover) cover.hidden = false; });
    v.addEventListener('timeupdate', function () { time(v.currentTime, v.duration); });
    v.addEventListener('loadedmetadata', function () { if (dbg) debugTick(v.currentTime, v.duration); });
    v.addEventListener('play', playing);
    v.addEventListener('pause', function () { if (!v.ended) paused(); else flush(); });
  } else if (cfg.control === 'youtube') {
    var poll;
    if (cfg.autoplay) muted = true;
    window.onYouTubeIframeAPIReady = function () {
      var yt = new YT.Player('vsl-frame', { events: { onStateChange: function (ev) {
        clearInterval(poll);
        var tick = function () { time(yt.getCurrentTime(), yt.getDuration()); };
        if (ev.data === 1) { playing(); poll = setInterval(tick, 500); }
        else if (ev.data === 2) { tick(); paused(); }
        else if (ev.data === 0) { tick(); flush(); }
      } } });
      player.play = function () { yt.playVideo(); };
      player.pause = function () { yt.pauseVideo(); };
      player.unmute = function () { yt.unMute(); yt.setVolume(100); yt.seekTo(0, true); yt.playVideo(); };
      if (wantPlay && !started) yt.playVideo();
    };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = function () { muted = false; if (unmuteBtn) unmuteBtn.hidden = true; letNativeTap(); fallbackTimer(); };
    document.head.appendChild(s);
  } else if (cfg.control === 'vimeo') {
    var f = document.getElementById('vsl-frame');
    var send = function (m, val) { f.contentWindow.postMessage(JSON.stringify(val === undefined ? { method: m } : { method: m, value: val }), 'https://player.vimeo.com'); };
    player.play = function () { send('play'); };
    player.pause = function () { send('pause'); };
    player.unmute = function () { send('setMuted', false); send('setVolume', 1); send('setCurrentTime', 0); send('play'); };
    if (cfg.autoplay) muted = true;
    window.addEventListener('message', function (ev) {
      if (ev.origin !== 'https://player.vimeo.com') return;
      var d; try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch (e) { return; }
      if (!d) return;
      if (d.event === 'ready') { ['play', 'pause', 'timeupdate', 'ended'].forEach(function (n) { send('addEventListener', n); }); }
      else if (d.event === 'play') playing();
      else if (d.event === 'pause') paused();
      else if (d.event === 'ended') flush();
      else if (d.event === 'timeupdate' && d.data) time(d.data.seconds, d.data.duration);
    });
  } else {
    fallbackTimer();
  }
})();`;
