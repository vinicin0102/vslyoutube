// HTML da página pública.

import { parseVideoUrl } from './content.js';

export const e = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const RATIO_CSS = { '9:16': '9 / 16', '16:9': '16 / 9', '1:1': '1 / 1', '4:5': '4 / 5' };

function player(v) {
  if (v.type === 'upload' && v.file) {
    return `<video id="vsl-video" src="${e(v.file)}" controls playsinline preload="metadata"></video>`;
  }
  if (v.type === 'embed' && v.embed.trim()) {
    return v.embed; // código do player (VTurb, Panda…) colado pelo administrador
  }
  if (v.type === 'url') {
    const p = parseVideoUrl(v.url);
    if (p.kind === 'video') return `<video id="vsl-video" src="${e(p.src)}" controls playsinline preload="metadata"></video>`;
    if (p.kind === 'iframe') {
      return `<iframe src="${e(p.src)}" title="Vídeo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    }
  }
  return '';
}

function testimonial(t) {
  const initial = (t.name || '?').trim().charAt(0).toUpperCase();
  const avatar = t.photo ? `<img src="${e(t.photo)}" alt="" loading="lazy">` : e(initial);
  const stars = t.rating > 0 ? `<span class="stars" aria-label="${t.rating} de 5 estrelas">${'★'.repeat(t.rating)}</span>` : '';
  const city = t.city ? `<span class="t-city">${e(t.city)}</span>` : '';
  const proof = t.proof ? `<img class="t-photo" src="${e(t.proof)}" alt="Imagem enviada por ${e(t.name)}" loading="lazy">` : '';
  return `<article class="t">
      <div class="avatar" aria-hidden="true">${avatar}</div>
      <div class="t-body">
        <div class="t-meta"><span class="t-name">${e(t.name)}</span>${city}${stars}</div>
        <p class="t-text">${e(t.text)}</p>${proof}
      </div>
    </article>`;
}

export function renderPage(d) {
  const v = d.video;
  const cta = d.cta;
  const wide = v.ratio === '16:9';
  const html = player(v);
  const custom = v.type === 'embed' && html;
  const showCta = cta.enabled && cta.url && cta.text.trim();
  const delay = cta.delay;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(d.title || d.brand_name)}</title>
<meta name="description" content="${e(d.subtitle)}">
<meta name="theme-color" content="#0f0f0f">
<style>
  :root { --bg:#0f0f0f; --surface:#1a1a1a; --line:#272727; --text:#f1f1f1; --muted:#aaaaaa; --cta:${cta.color}; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text); }
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
  .player iframe, .player video { width: 100%; height: 100%; border: 0; display: block; object-fit: cover; background: #000; }
  .player.custom { aspect-ratio: auto; background: none; box-shadow: none; }
  .player-empty { height: 100%; display: grid; place-items: center; padding: 24px; text-align: center; color: var(--muted); font-size: 14px; background: var(--surface); }
  .cta-wrap { text-align: center; margin: 24px auto 0; max-width: 520px; }
  .cta-wrap[hidden] { display: none; }
  .cta { display: block; width: 100%; padding: 18px 20px; border-radius: 10px; background: var(--cta); color: #fff; text-decoration: none; font-weight: 800; font-size: 17px; letter-spacing: .01em; box-shadow: 0 6px 24px color-mix(in srgb, var(--cta) 45%, transparent); animation: pulse 1.8s ease-in-out infinite; }
  .cta:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
  @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }
  @media (prefers-reduced-motion: reduce) { .cta { animation: none; } }
  .cta-wrap.reveal { animation: fadein .5s ease-out both; }
  @keyframes fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .testimonials { max-width: 680px; margin: 48px auto 0; }
  .testimonials h2 { margin: 0 0 20px; font-size: 19px; font-weight: 700; }
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
</style>
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
  </div>
  ${showCta ? `<div class="cta-wrap" id="cta"${delay > 0 ? ' hidden' : ''}><a class="cta" href="${e(cta.url)}">${e(cta.text)}</a></div>` : ''}
  ${
    d.testimonials.length
      ? `<section class="testimonials" aria-labelledby="t-title">
    <h2 id="t-title">${e(d.testimonials_title)}<span>${d.testimonials.length}</span></h2>
    ${d.testimonials.map(testimonial).join('\n    ')}
  </section>`
      : ''
  }
</main>
${
  d.footer_text.trim() || d.disclaimer.trim()
    ? `<footer>
  ${d.footer_text.trim() ? `<p>${e(d.footer_text)}</p>` : ''}
  ${d.disclaimer.trim() ? `<p>${e(d.disclaimer)}</p>` : ''}
</footer>`
    : ''
}
${
  showCta && delay > 0
    ? `<script>
  // Mostra o botão depois de X segundos de vídeo assistido (vídeo próprio)
  // ou de página aberta (players externos, que não expõem o tempo).
  (function () {
    var delay = ${delay}, cta = document.getElementById('cta');
    var video = document.getElementById('vsl-video'), done = false;
    function show() {
      if (done) return; done = true;
      cta.hidden = false; cta.classList.add('reveal');
      try { localStorage.setItem('vsl_cta_seen', '1'); } catch (e) {}
    }
    try { if (localStorage.getItem('vsl_cta_seen') === '1') return show(); } catch (e) {}
    if (video) video.addEventListener('timeupdate', function () { if (video.currentTime >= delay) show(); });
    else setTimeout(show, delay * 1000);
  })();
</script>`
    : ''
}
</body>
</html>`;
}
