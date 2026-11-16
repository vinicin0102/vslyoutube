// Conteúdo da VSL: valores padrão e validação de tudo que vem do painel.

export const RATIOS = ['9:16', '4:5', '1:1', '16:9'];
export const VIDEO_TYPES = ['url', 'upload', 'embed'];

export function defaults() {
  return {
    brand_name: 'Sua Marca',
    logo: '',
    badge: 'Assista até o final',
    title: 'Seu título principal aqui',
    subtitle: 'Uma linha de apoio que reforça a promessa do vídeo',
    video: { type: 'url', url: '', file: '', embed: '', ratio: '9:16' },
    cta: { enabled: true, text: 'QUERO GARANTIR O MEU', url: '', delay: 0, color: '#16a34a' },
    testimonials_title: 'Depoimentos de clientes',
    testimonials: [],
    footer_text: '',
    disclaimer: 'Os resultados podem variar de pessoa para pessoa.',
    head_code: '',
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
    badge: pick('badge', 120),
    title: pick('title', 300),
    subtitle: pick('subtitle', 300),
    video: {
      type: VIDEO_TYPES.includes(v.type) ? v.type : d.video.type,
      url: safeUrl(v.url),
      file: mediaUrl(v.file),
      embed: String(v.embed ?? '').slice(0, 20000),
      ratio: RATIOS.includes(v.ratio) ? v.ratio : d.video.ratio,
    },
    cta: {
      enabled: 'enabled' in c ? Boolean(c.enabled) : d.cta.enabled,
      text: 'text' in c ? str(c.text, 80) : d.cta.text,
      url: safeUrl(c.url),
      delay: int(c.delay, 0, 36000),
      color: color(c.color, d.cta.color),
    },
    testimonials_title: pick('testimonials_title', 120),
    testimonials,
    footer_text: pick('footer_text', 2000),
    disclaimer: pick('disclaimer', 2000),
    head_code: String(i.head_code ?? '').slice(0, 20000),
    updatedAt: Number(i.updatedAt) || 0,
  };
}

/** Todas as URLs de mídia usadas — para apagar as que deixaram de ser usadas. */
export function mediaIn(d) {
  const list = [d.logo, d.video.file];
  for (const t of d.testimonials) list.push(t.photo, t.proof);
  return list.filter(Boolean);
}

/** Converte links do YouTube/Vimeo para o endereço de embed. */
export function parseVideoUrl(raw) {
  const url = safeUrl(raw);
  if (!url) return { kind: '', src: '' };
  let m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (m) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1&playsinline=1` };
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}` };
  if (/\.(mp4|webm)(\?.*)?$/i.test(url)) return { kind: 'video', src: url };
  return { kind: 'iframe', src: url };
}
