import { salesDefaults, sanitizeSales, salesMedia } from './sales-content.js';
import { upsellsDefaults, sanitizeUpsells, upsellsMedia } from './upsell-content.js';
// Conteúdo da VSL: valores padrão e validação de tudo que vem do painel.

export const RATIOS = ['9:16', '4:5', '1:1', '16:9'];
export const VIDEO_TYPES = ['url', 'upload', 'embed'];

/** "123, 456 789" -> ['123', '456', '789'] (só IDs válidos, sem repetir, até 5). */
export function pixelIds(v) {
  return [...new Set(String(v ?? '').split(/[\s,;]+/).filter((x) => /^\d{10,20}$/.test(x)))].slice(0, 5);
}

export function defaults() {
  return {
    brand_name: 'Sua Marca',
    logo: '',
    favicon: '', // ícone da aba do navegador
    badge: 'Assista até o final',
    title: 'Seu título principal aqui',
    subtitle: 'Uma linha de apoio que reforça a promessa do vídeo',
    video: { type: 'url', url: '', file: '', embed: '', ratio: '9:16', pause_image: '', autoplay: true },
    cta: {
      enabled: true,
      text: 'QUERO GARANTIR O MEU',
      url: '',
      delay: 0, // momento do pitch, em segundos de vídeo
      color: '#16a34a',
      offer_text: '',
      hide_below: false, // esconder depoimentos e rodapé até o pitch
    },
    testimonials_title: 'Depoimentos de clientes',
    testimonials: [],
    testimonial_images: [], // prints de depoimentos enviados de uma vez
    footer_text: '',
    disclaimer: 'Os resultados podem variar de pessoa para pessoa.',
    head_code: '',
    exit_popup: {
      enabled: true,
      delay: 15, // segundos na página antes de poder aparecer
      tag: 'ESPERA!',
      title: 'Antes de sair, olha isso',
      text: 'Você está a um passo de ajudar o seu cachorro a se livrar da coceira e do mau cheiro. Leve o guia completo, com todos os bônus, por:',
      offer_text: '', // vazio = mesmo preço da oferta
      button: 'QUERO APROVEITAR AGORA',
      url: '', // vazio = mesmo link de checkout
      image: '',
      note: '🔒 Compra segura · Acesso imediato · Garantia de 7 dias',
    },
    meta_pixel_id: '', // um ou mais IDs separados por vírgula; soma com META_PIXEL_ID da Vercel
    metrics_epoch: 0, // trocar zera as métricas
    sales: salesDefaults(),
    upsells: upsellsDefaults(),
    updatedAt: 0,
  };
}

const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);

/** Só links http(s) — bloqueia javascript:, data: e afins. */
export function safeUrl(v) {
  const s = str(v, 2000);
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

/** Arquivos enviados pelo painel: só URLs https do Vercel Blob. */
export function mediaUrl(v) {
  // Arquivos que vêm com o site (pasta public/media), como a mini VSL e as fotos da página de vendas.
  if (/^\/media\/[a-z0-9._-]{1,80}$/i.test(String(v ?? '').trim())) return String(v).trim();
  const s = safeUrl(v);
  if (!s) return '';
  const u = new URL(s);
  // Modo local de desenvolvimento (npm run dev).
  if (process.env.VSL_LOCAL_DIR && u.hostname === '127.0.0.1') return s;
  if (u.protocol !== 'https:') return '';
  return u.hostname.endsWith('.blob.vercel-storage.com') ? s : '';
}

export function isOwnMedia(url) {
  try {
    return new URL(url).hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

const color = (v, fb) => (/^#[0-9a-f]{6}$/i.test(String(v ?? '').trim()) ? String(v).trim().toLowerCase() : fb);
const int = (v, min, max) => Math.max(min, Math.min(max, Number.parseInt(v, 10) || 0));

/** Normaliza o conteúdo (vindo do painel ou do armazenamento). */
function sanitizeExit(x, d) {
  x = x && typeof x === 'object' ? x : {};
  const pick = (k, max) => (k in x ? str(x[k], max) : d[k]);
  return {
    enabled: 'enabled' in x ? Boolean(x.enabled) : d.enabled,
    delay: 'delay' in x ? Math.max(0, Math.min(600, Math.floor(Number(x.delay) || 0))) : d.delay,
    tag: pick('tag', 60),
    title: pick('title', 160),
    text: pick('text', 600),
    offer_text: pick('offer_text', 200),
    button: pick('button', 80),
    url: 'url' in x ? safeUrl(x.url) : d.url,
    image: mediaUrl(x.image),
    note: pick('note', 200),
  };
}

export function sanitize(input) {
  const d = defaults();
  const i = input && typeof input === 'object' ? input : {};
  const v = i.video && typeof i.video === 'object' ? i.video : {};
  const c = i.cta && typeof i.cta === 'object' ? i.cta : {};
  const pick = (k, max) => (k in i ? str(i[k], max) : d[k]);

  const seen = new Set();
  const testimonials = (Array.isArray(i.testimonials) ? i.testimonials : [])
    .slice(0, 300)
    .map((t) => {
      t = t && typeof t === 'object' ? t : {};
      let id = /^[a-z0-9]{6,32}$/.test(String(t.id)) ? String(t.id) : Math.random().toString(36).slice(2, 12);
      while (seen.has(id)) id = Math.random().toString(36).slice(2, 12);
      seen.add(id);
      return {
        id,
        name: str(t.name, 80),
        city: str(t.city, 80),
        rating: int(t.rating, 0, 5),
        text: str(t.text, 3000),
        photo: mediaUrl(t.photo),
        proof: mediaUrl(t.proof),
      };
    })
    .filter((t) => t.name || t.text || t.photo || t.proof);

  return {
    brand_name: pick('brand_name', 80),
    logo: 'logo' in i ? mediaUrl(i.logo) : d.logo,
    favicon: mediaUrl(i.favicon),
    badge: pick('badge', 120),
    title: pick('title', 300),
    subtitle: pick('subtitle', 300),
    video: {
      type: VIDEO_TYPES.includes(v.type) ? v.type : d.video.type,
      url: safeUrl(v.url),
      file: mediaUrl(v.file),
      embed: String(v.embed ?? '').slice(0, 20000),
      ratio: RATIOS.includes(v.ratio) ? v.ratio : d.video.ratio,
      pause_image: mediaUrl(v.pause_image),
      autoplay: 'autoplay' in v ? Boolean(v.autoplay) : d.video.autoplay,
    },
    cta: {
      enabled: 'enabled' in c ? Boolean(c.enabled) : d.cta.enabled,
      text: 'text' in c ? str(c.text, 80) : d.cta.text,
      url: safeUrl(c.url),
      delay: int(c.delay, 0, 36000),
      color: color(c.color, d.cta.color),
      offer_text: str(c.offer_text, 300),
      hide_below: Boolean(c.hide_below),
    },
    testimonials_title: pick('testimonials_title', 120),
    testimonials,
    testimonial_images: (Array.isArray(i.testimonial_images) ? i.testimonial_images : [])
      .slice(0, 100)
      .map(mediaUrl)
      .filter(Boolean),
    footer_text: pick('footer_text', 2000),
    disclaimer: pick('disclaimer', 2000),
    head_code: String(i.head_code ?? '').slice(0, 20000),
    exit_popup: sanitizeExit(i.exit_popup, d.exit_popup),
    meta_pixel_id: pixelIds(i.meta_pixel_id).join(','),
    metrics_epoch: Math.max(0, Math.min(1e6, Math.floor(Number(i.metrics_epoch) || 0))),
    sales: sanitizeSales(i.sales),
    upsells: sanitizeUpsells(i.upsells),
    updatedAt: Number(i.updatedAt) || 0,
  };
}

/** Todas as URLs de mídia usadas — para apagar as que deixaram de ser usadas. */
export function mediaIn(d) {
  const list = [d.logo, d.favicon, d.video.file, d.video.pause_image, d.exit_popup.image];
  for (const t of d.testimonials) list.push(t.photo, t.proof);
  list.push(...d.testimonial_images);
  if (d.sales) list.push(...salesMedia(d.sales));
  if (d.upsells) list.push(...upsellsMedia(d.upsells));
  return list.filter(Boolean);
}

/** Converte links do YouTube/Vimeo para o endereço de embed. */
export function parseVideoUrl(raw) {
  const url = safeUrl(raw);
  if (!url) return { kind: '', src: '' };
  let m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return { kind: 'iframe', provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&controls=0&disablekb=1&fs=0&iv_load_policy=3` };
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: 'iframe', provider: 'vimeo', src: `https://player.vimeo.com/video/${m[1]}?api=1&controls=0&title=0&byline=0&portrait=0` };
  if (/\.(mp4|webm)(\?.*)?$/i.test(url)) return { kind: 'video', src: url };
  return { kind: 'iframe', src: url };
}
