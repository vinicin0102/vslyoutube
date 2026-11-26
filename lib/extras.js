// Blocos usados na VSL e na página de vendas:
//  - tour: vídeo "veja por dentro da área de membros"
//  - promo: faixa de promoção perto do botão de compra (ex.: sorteio para quem compra)
import { mediaUrl, safeUrl } from './content.js';

const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const TOUR_VIDEO = '/media/tour-area.mp4';
const TOUR_POSTER = '/media/tour-area.jpg';
const MEDIA_V = '1'; // muda quando o vídeo padrão for trocado (o celular guarda /media por 7 dias)

export function tourDefaults() {
  return {
    on_sales: true,
    on_vsl: true,
    kicker: 'Por dentro do app',
    title: 'Veja tudo o que você vai receber',
    text: 'Videoaulas, bônus, chat 24h e o app no seu celular. Tudo liberado logo depois da compra.',
    video: TOUR_VIDEO,
  };
}

export function promoDefaults() {
  return {
    enabled: false,
    title: 'Comprando hoje, você concorre a 1 ano de ração premium grátis para o seu pet',
    note: '',
    rules_url: '',
  };
}

const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);

export function sanitizeTour(input) {
  const d = tourDefaults();
  const i = input && typeof input === 'object' ? input : {};
  const pick = (k, max) => (k in i ? str(i[k], max) : d[k]);
  return {
    on_sales: 'on_sales' in i ? Boolean(i.on_sales) : d.on_sales,
    on_vsl: 'on_vsl' in i ? Boolean(i.on_vsl) : d.on_vsl,
    kicker: pick('kicker', 80),
    title: pick('title', 200),
    text: pick('text', 600),
    video: 'video' in i ? mediaUrl(i.video) : d.video,
  };
}

export function sanitizePromo(input) {
  const d = promoDefaults();
  const i = input && typeof input === 'object' ? input : {};
  const pick = (k, max) => (k in i ? str(i[k], max) : d[k]);
  return {
    enabled: 'enabled' in i ? Boolean(i.enabled) : d.enabled,
    title: pick('title', 200),
    note: pick('note', 300),
    rules_url: 'rules_url' in i ? safeUrl(i.rules_url) : d.rules_url,
  };
}

/* ---------- HTML ---------- */

/** Faixa da promoção (perto do botão). */
export function promoHtml(d) {
  const p = d.promo;
  if (!p?.enabled || !p.title) return '';
  const rules = p.rules_url ? ` <a href="${e(p.rules_url)}" target="_blank" rel="noopener">Ver regulamento</a>` : '';
  return `<div class="promo" role="note"><span class="promo-ic" aria-hidden="true">🎁</span><div><b>${e(p.title)}</b>${p.note || rules ? `<small>${e(p.note)}${rules}</small>` : ''}</div></div>`;
}

/** Seção com o vídeo da área de membros. where = 'vsl' | 'sales' */
export function tourHtml(d, where, attrs = '') {
  const t = d.tour;
  if (!t || !t.video || !(where === 'vsl' ? t.on_vsl : t.on_sales)) return '';
  const isDefault = t.video === TOUR_VIDEO;
  const src = isDefault ? `${TOUR_VIDEO}?v=${MEDIA_V}` : t.video;
  const poster = isDefault ? ` poster="${TOUR_POSTER}?v=${MEDIA_V}"` : '';
  return `<section class="tour" id="por-dentro" aria-labelledby="tour-title"${attrs}>
  <div class="tour-in">
    <div class="tour-copy">
      ${t.kicker ? `<p class="tour-kick">${e(t.kicker)}</p>` : ''}
      ${t.title ? `<h2 id="tour-title">${e(t.title)}</h2>` : ''}
      ${t.text ? `<p class="tour-txt">${e(t.text)}</p>` : ''}
      <ul class="tour-list"><li>🎬 Videoaulas passo a passo</li><li>🎁 Bônus: shampoo, lista negra e lista de compras</li><li>💬 Chat 24h com auxiliar veterinário virtual</li><li>📲 App instalado no celular</li></ul>
    </div>
    <div class="tour-phone">
      <video class="tour-v" src="${e(src)}"${poster} muted playsinline loop preload="none"></video>
      <button type="button" class="tour-sound" aria-label="Ouvir o vídeo com som"><span>🔊</span> Toque para ouvir</button>
    </div>
  </div>
</section>`;
}

// Começa sem som quando aparece na tela (a legenda está no vídeo); um toque liga o som do início.
export const TOUR_SCRIPT = `(function () {
  var s = document.querySelector('.tour'); if (!s) return;
  var v = s.querySelector('.tour-v'), b = s.querySelector('.tour-sound'), loud = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { es.forEach(function (en) {
      if (en.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(function () {}); } else if (!loud) v.pause();
    }); }, { threshold: 0.35 }).observe(v);
  }
  function sound() { loud = true; v.muted = false; v.loop = false; v.currentTime = 0; v.controls = true; v.play().catch(function () {}); b.hidden = true; }
  b.addEventListener('click', sound);
  v.addEventListener('click', function () { if (!loud) sound(); });
})();`;

/** CSS dos blocos. theme = 'vsl' (escuro, estilo YouTube) | 'sales' (verde/creme da página de vendas) */
export function extrasCss(theme) {
  const vsl = theme === 'vsl';
  return `
  .promo { display: flex; align-items: flex-start; gap: 10px; margin: 0 auto 14px; max-width: 460px; padding: 11px 13px; border-radius: 12px; text-align: left;
    background: ${vsl ? 'linear-gradient(90deg, #3a2405, #2a1a06)' : '#fff4dc'}; border: 1.5px dashed ${vsl ? '#f59e0b' : '#e8a317'}; color: ${vsl ? '#fde7b8' : '#5b3a00'}; }
  .promo-ic { flex: none; font-size: 24px; line-height: 1; animation: promo-wig 2.4s ease-in-out infinite; }
  @keyframes promo-wig { 0%, 80%, 100% { transform: rotate(0); } 85% { transform: rotate(-12deg); } 90% { transform: rotate(10deg); } 95% { transform: rotate(-6deg); } }
  @media (prefers-reduced-motion: reduce) { .promo-ic { animation: none; } }
  .promo b { display: block; font-size: 14.5px; line-height: 1.3; font-weight: 800; }
  .promo small { display: block; margin-top: 3px; font-size: 12px; line-height: 1.35; opacity: .85; }
  .promo a { color: inherit; text-decoration: underline; }

  .tour { ${vsl ? 'margin: 34px 0 8px; padding: 22px 16px; border-radius: 16px; background: linear-gradient(180deg, #1c1c1c, #141414); border: 1px solid #2b2b2b;' : 'padding: 72px 0; background: var(--folha-fundo); color: #e6efe8;'} }
  .tour-in { ${vsl ? '' : 'width: 100%; max-width: 1000px; margin: 0 auto; padding: 0 20px;'} display: grid; gap: 22px; justify-items: center; text-align: center; }
  .tour-kick { margin: 0 0 8px; font-size: 12.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: ${vsl ? '#fbbf24' : 'var(--abobora-luz)'}; }
  .tour h2 { margin: 0; font-size: ${vsl ? 'clamp(22px, 5.6vw, 28px)' : 'clamp(28px, 6.6vw, 42px)'}; line-height: 1.08; font-weight: 800; letter-spacing: -.015em; ${vsl ? '' : 'font-family: var(--display); font-stretch: 108%; color: #fff; text-wrap: balance;'} }
  .tour-txt { margin: 10px auto 0; max-width: 520px; font-size: ${vsl ? '15px' : '17.5px'}; line-height: 1.55; color: ${vsl ? '#c9c9c9' : '#cfe0d3'}; ${vsl ? '' : 'font-family: var(--carta);'} }
  .tour-list { list-style: none; margin: 16px auto 0; padding: 0; display: grid; gap: 8px; max-width: 420px; text-align: left; }
  .tour-list li { padding: 10px 13px; border-radius: 12px; background: ${vsl ? '#222' : 'rgba(255,255,255,.07)'}; border: 1px solid ${vsl ? '#2f2f2f' : 'rgba(255,255,255,.12)'}; font-size: 14.5px; font-weight: 700; }
  .tour-phone { position: relative; width: 100%; max-width: ${vsl ? '300px' : '320px'}; aspect-ratio: 9 / 16; border-radius: 26px; overflow: hidden; background: #000;
    box-shadow: 0 0 0 6px ${vsl ? '#262626' : 'rgba(255,255,255,.08)'}, 0 30px 60px -20px rgba(0,0,0,.7); }
  .tour-v { width: 100%; height: 100%; display: block; object-fit: cover; cursor: pointer; }
  .tour-sound { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border: 0; border-radius: 999px;
    background: ${vsl ? '#f59e0b' : 'var(--abobora)'}; color: ${vsl ? '#1a0f00' : '#fff'}; font: 800 14px/1 ${vsl ? 'inherit' : 'var(--display)'}; cursor: pointer; box-shadow: 0 8px 22px rgba(0,0,0,.45); animation: tour-pulse 1.8s ease-in-out infinite; white-space: nowrap; }
  .tour-sound[hidden] { display: none; }
  @keyframes tour-pulse { 50% { transform: translateX(-50%) scale(1.06); } }
  ${vsl ? '' : '@media (min-width: 860px) { .tour-in { grid-template-columns: 1fr 340px; gap: 56px; align-items: center; text-align: left; justify-items: start; } .tour-list { margin-left: 0; } .tour-txt { margin-left: 0; } }'}
  `;
}
