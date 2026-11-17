// HTML da página pública.

import { parseVideoUrl } from './content.js';
import { metricsConfigured } from './metrics.js';

export const e = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const RATIO_CSS = { '9:16': '9 / 16', '16:9': '16 / 9', '1:1': '1 / 1', '4:5': '4 / 5' };

/** HTML do player e como o script da página controla o vídeo. */
function player(v) {
  const native = (src) => ({
    html: `<video id="vsl-video" src="${e(src)}" playsinline preload="metadata"></video>`,
    control: 'video',
  });
  if (v.type === 'upload' && v.file) return native(v.file);
  if (v.type === 'embed' && v.embed.trim()) {
    // Código do player (VTurb, Panda…) colado pelo administrador: não expõe o tempo do vídeo.
    return { html: v.embed, control: 'none' };
  }
  if (v.type === 'url') {
    const p = parseVideoUrl(v.url);
    if (p.kind === 'video') return native(p.src);
    if (p.kind === 'iframe') {
      return {
        html: `<iframe id="vsl-frame" src="${e(p.src)}" title="Vídeo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`,
        control: p.provider || 'none',
      };
    }
  }
  return { html: '', control: 'none' };
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

// "de 289 por 27,90" vira preço antigo riscado em vermelho + preço novo em destaque.
const money = (v) => (/^[\d.,\s]+$/.test(v) ? 'R$ ' + v.trim() : v.trim());
function offerHtml(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  // Aspas digitadas junto (ex.: de"289 por 27,90") são ignoradas.
  const m = t.replace(/["“”'‘’]/g, ' ').replace(/\s+/g, ' ').trim().match(/^de\s+(.+?)\s+por\s+(?:apenas\s+|só\s+)?(.+?)$/i);
  if (!m) return `<p class="offer">${e(t)}</p>`;
  return `<p class="price" aria-label="De ${e(money(m[1]))} por ${e(money(m[2]))}">`
    + `<span class="lbl">de</span><span class="old"><s style="text-decoration:none">${e(money(m[1]))}</s></span>`
    + `<span class="lbl">por</span><span class="new">${e(money(m[2]))}</span></p>`;
}

function pixelBase(id) {
  return `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"></noscript>`;
}

/** "R$ 27,90" -> 27.9 (para o valor do InitiateCheckout). */
function priceValue(text) {
  const m = String(text || '').match(/por\s+(?:apenas\s+|só\s+)?(?:R\$\s*)?([\d.]*\d(?:,\d{1,2})?)/i);
  if (!m) return 0;
  return Number(m[1].replace(/\./g, '').replace(',', '.')) || 0;
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
  const pixel = d.meta_pixel_id || (/^\d{10,20}$/.test(process.env.META_PIXEL_ID || '') ? process.env.META_PIXEL_ID : '');
  const cfg = { pitch, control, pause: Boolean(pauseImg), track, e: d.metrics_epoch, px: Boolean(pixel), price: priceValue(cta.offer_text) };

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
  .t-gallery { margin-bottom: 8px; }
  .t-gallery img { display: block; width: 100%; height: auto; margin: 0 0 14px; }
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
${pixel ? pixelBase(pixel) : ''}
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
    ${pauseImg ? `<button type="button" class="pause-overlay" id="vsl-pause" hidden aria-label="Continuar assistindo">${/\.(mp4|webm)(\?|$)/i.test(pauseImg) ? `<video src="${e(pauseImg)}" muted loop playsinline preload="metadata"></video>` : `<img src="${e(pauseImg)}" alt="">`}</button>` : ''}
  </div>
  ${
    showCta
      ? `<div class="cta-wrap"${pitchAttr(gated)}>
    ${offerHtml(cta.offer_text)}
    <a class="cta" href="${e(cta.url)}">${e(cta.text)}</a>
  </div>`
      : ''
  }
  ${
    d.testimonials.length || d.testimonial_images.length
      ? `<section class="testimonials" aria-labelledby="t-title"${pitchAttr(hideBelow)}>
    ${d.testimonials_title.trim() ? `<h2 id="t-title">${e(d.testimonials_title)}${d.testimonials.length && !d.testimonial_images.length ? `<span>${d.testimonials.length}</span>` : ''}</h2>` : ''}
    ${d.testimonial_images.length ? `<div class="t-gallery">${d.testimonial_images.map((u) => `<img src="${e(u)}" alt="Depoimento de cliente" loading="lazy">`).join('')}</div>` : ''}
    ${d.testimonials.map(testimonial).join('\n    ')}
  </section>`
      : ''
  }
</main>
${
  d.footer_text.trim() || d.disclaimer.trim()
    ? `<footer${pitchAttr(hideBelow)}>
  ${d.footer_text.trim() ? `<p>${e(d.footer_text)}</p>` : ''}
  ${d.disclaimer.trim() ? `<p>${e(d.disclaimer)}</p>` : ''}
</footer>`
    : ''
}
${needsScript ? `<script>window.VSL_CFG = ${JSON.stringify(cfg)};</script>\n<script>${PAGE_SCRIPT}</script>` : ''}
</body>
</html>`;
}

// Controla o vídeo na página: revela a oferta no momento do pitch e mostra a
// imagem de pausa. Funciona com vídeo próprio (MP4), YouTube e Vimeo; com
// código de player externo, o pitch conta o tempo de página aberta.
const PAGE_SCRIPT = `(function () {
  var cfg = window.VSL_CFG, KEY = 'vsl_pitch_' + cfg.pitch, done = false;
  var overlay = document.getElementById('vsl-pause');
  var ovVideo = overlay && overlay.querySelector('video');
  var player = { play: function () {}, pause: function () {} };
  var cover = document.getElementById('vsl-play');
  var tap = document.getElementById('vsl-tap');
  var started = false, wantPlay = false;

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
      src: qs.get('utm_source') || ref || 'direto', p: 0, m: 0, d: 0, h: 0, c: 0 };
  }
  /* ---- Meta Pixel: cada evento uma vez por visita (a prévia do painel não dispara) ---- */
  var sent = {};
  function px(kind, name, params, key) {
    key = key || name;
    if (!cfg.px || qs.has('v') || sent[key] || typeof fbq !== 'function') return;
    sent[key] = 1;
    fbq(kind, name, params || {});
  }
  // Clique no botão: dispara InitiateCheckout e espera um instante antes de ir ao checkout,
  // para o evento não se perder na troca de página.
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a.cta');
    if (!a) return;
    var params = cfg.price > 0 ? { value: cfg.price, currency: 'BRL' } : {};
    if (cfg.px && typeof fbq === 'function' && !qs.has('v') && !sent.InitiateCheckout && !(ev.ctrlKey || ev.metaKey || ev.shiftKey)) {
      ev.preventDefault();
      px('track', 'InitiateCheckout', params);
      setTimeout(function () { location.href = a.href; }, 350);
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

  function reveal() {
    if (done) return; done = true;
    document.querySelectorAll('[data-pitch]').forEach(function (el) { el.hidden = false; el.classList.add('reveal'); });
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
  }
  function time(t, dur) {
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
    if (tap) tap.hidden = true;
    if (overlay) {
      overlay.hidden = false;
      if (ovVideo) { ovVideo.currentTime = 0; ovVideo.play().catch(function () {}); }
    } else if (cover) cover.hidden = false;
    flush();
  }
  function playing() {
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
    v.addEventListener('ended', function () { if (tap) tap.hidden = true; if (cover) cover.hidden = false; });
    v.addEventListener('timeupdate', function () { time(v.currentTime, v.duration); });
    v.addEventListener('loadedmetadata', function () { if (dbg) debugTick(v.currentTime, v.duration); });
    v.addEventListener('play', playing);
    v.addEventListener('pause', function () { if (!v.ended) paused(); else flush(); });
  } else if (cfg.control === 'youtube') {
    var poll;
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
      if (wantPlay && !started) yt.playVideo();
    };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = function () { letNativeTap(); fallbackTimer(); };
    document.head.appendChild(s);
  } else if (cfg.control === 'vimeo') {
    var f = document.getElementById('vsl-frame');
    var send = function (m, val) { f.contentWindow.postMessage(JSON.stringify(val === undefined ? { method: m } : { method: m, value: val }), 'https://player.vimeo.com'); };
    player.play = function () { send('play'); };
    player.pause = function () { send('pause'); };
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
