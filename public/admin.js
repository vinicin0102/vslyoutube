const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const HDR = { 'content-type': 'application/json', 'x-vsl': '1' };
const LAST_SAVED = 'vsl_last_saved';

let localUploads = false;
let storageWarning = '';
let uploadModeName = 'presigned';
let pending = 0; // uploads em andamento
let dirty = false;

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...opts });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || `Erro ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function show(id) {
  for (const v of ['view-setup', 'view-login', 'view-editor']) $('#' + v).hidden = v !== id;
}

function flash(box, type, text) {
  const div = document.createElement('div');
  div.className = 'flash ' + type;
  div.setAttribute('role', type === 'err' ? 'alert' : 'status');
  div.textContent = text;
  box.replaceChildren(div);
  if (type === 'ok') setTimeout(() => div.remove(), 4000);
}

/* ---------- envio de arquivos ---------- */

let blobClient;
async function uploadFile(file, kind, onProgress) {
  const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-80) || 'arquivo';
  if (localUploads) {
    // Só no ambiente local (npm run dev).
    const res = await fetch('/api/dev-upload?name=' + encodeURIComponent(safe), {
      method: 'POST', headers: { 'content-type': file.type, 'x-vsl': '1' }, body: file,
    });
    if (!res.ok) throw new Error((await res.json()).error);
    onProgress(100);
    return (await res.json()).url;
  }
  blobClient ??= await import('/vendor/blob-client.js');
  const send = uploadModeName === 'token' ? blobClient.upload : blobClient.uploadPresigned;
  const blob = await send('vsl/uploads/' + safe, file, {
    access: 'public',
    handleUploadUrl: '/api/upload',
    clientPayload: kind,
    headers: { 'x-vsl': '1' },
    multipart: file.size > 50 * 1024 * 1024,
    onUploadProgress: (p) => onProgress(p.percentage),
  });
  return blob.url;
}

// A aba "Área de membros" (area-admin.js) usa o mesmo envio de arquivos.
window.vslUpload = (file, kind, onProgress) => uploadFile(file, kind, onProgress);

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
// Tipos aceitos por campo: "pause" aceita imagem ou vídeo curto.
const ICON_TYPES = [...IMAGE_TYPES, 'image/x-icon', 'image/vnd.microsoft.icon'];
const ACCEPT = { image: IMAGE_TYPES, video: VIDEO_TYPES, pause: [...IMAGE_TYPES, ...VIDEO_TYPES], media: [...IMAGE_TYPES, ...VIDEO_TYPES], icon: ICON_TYPES };
const ACCEPT_LABEL = { image: 'JPG, PNG, WEBP ou GIF', video: 'MP4 ou WEBM', pause: 'JPG, PNG, WEBP, GIF, MP4 ou WEBM', media: 'JPG, PNG, WEBP, GIF, MP4 ou WEBM', icon: 'PNG, ICO, JPG, WEBP ou GIF' };
const isVideoUrl = (u) => /\.(mp4|webm)(\?|$)/i.test(u || '');

/** Campo de mídia: miniatura do arquivo atual, botão remover e seletor de arquivo. */
function setupMedia(el, url) {
  const kind = el.dataset.kind;
  el.dataset.value = url || '';
  el.querySelectorAll(':scope > :not(.media-label)').forEach((n) => n.remove());

  const current = document.createElement('div');
  current.className = 'media-current';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT[kind].join(',');
  const bar = document.createElement('div');
  bar.className = 'progress';
  bar.hidden = true;
  bar.innerHTML = '<div></div>';
  const err = document.createElement('div');
  err.className = 'media-err';
  el.append(current, input, bar, err);

  function paint() {
    current.replaceChildren();
    const v = el.dataset.value;
    current.hidden = !v;
    if (!v) return;
    let thumb;
    if (kind === 'video' || ((kind === 'pause' || kind === 'media') && isVideoUrl(v))) {
      thumb = document.createElement('video');
      thumb.muted = true;
      thumb.preload = 'metadata';
    } else {
      thumb = document.createElement('img');
      thumb.alt = '';
    }
    thumb.src = v;
    thumb.className = 'thumb' + ('round' in el.dataset ? ' round' : '') + (/(^|_)logo$/.test(el.dataset.media) ? ' logo' : '');
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'small danger';
    rm.textContent = 'Remover';
    rm.onclick = () => { el.dataset.value = ''; dirty = true; paint(); };
    current.append(thumb, rm);
  }
  paint();

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    err.textContent = '';
    if (!ACCEPT[kind].includes(file.type) && !(kind === 'icon' && /\.ico$/i.test(file.name))) {
      err.textContent = `Formato não aceito neste campo (${file.type || 'desconhecido'}). Envie ${ACCEPT_LABEL[kind]}.`;
      input.value = '';
      return;
    }
    bar.hidden = false;
    bar.firstChild.style.width = '0';
    pending++;
    syncSave();
    try {
      el.dataset.value = await uploadFile(file, kind, (p) => (bar.firstChild.style.width = p + '%'));
      dirty = true;
      if (el.dataset.media.endsWith('video_file')) {
        const r = $(`input[name="${el.dataset.media.replace(/video_file$/, '')}video_type"][value=upload]`);
        if (r) { r.checked = true; syncPanes(); }
      }
      paint();
    } catch (ex) {
      err.textContent = 'Falha no envio: ' + ex.message;
    } finally {
      pending--;
      input.value = '';
      bar.hidden = true;
      syncSave();
    }
  });
}

function syncSave() {
  for (const b of $$('.savebtn')) {
    b.disabled = pending > 0;
    b.textContent = pending > 0 ? 'Aguardando envio…' : 'Salvar alterações';
  }
}

/* ---------- depoimentos ---------- */

const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, '0')).join('');

function addRow(t = {}) {
  const row = $('#ttpl').content.firstElementChild.cloneNode(true);
  row.dataset.id = /^[a-z0-9]{6,32}$/.test(t.id || '') ? t.id : rid();
  for (const f of $$('[data-f]', row)) f.value = t[f.dataset.f] ?? (f.dataset.f === 'rating' ? '0' : '');
  $('.trow-title', row).textContent = t.name || 'Novo depoimento';
  setupMedia($('[data-media=photo]', row), t.photo);
  setupMedia($('[data-media=proof]', row), t.proof);
  $('#tlist').append(row);
  syncEmpty();
  return row;
}

const syncEmpty = () => ($('#tempty').hidden = $('#tlist').children.length > 0);

/* ---------- imagens de depoimentos (várias de uma vez) ---------- */

/** Lista de imagens com envio múltiplo, reordenar e remover. ids: <p>gallery, <p>gallery-input… */
function makeGallery(p) {
  const g = { items: [] };
  const box = $(`#${p}gallery`);
  g.render = () => {
    box.replaceChildren(...g.items.map((url, i) => {
      const item = document.createElement('div');
      item.className = 'gitem';
      const img = document.createElement(isVideoUrl(url) ? 'video' : 'img');
      img.src = url;
      if (isVideoUrl(url)) { img.muted = true; img.preload = 'metadata'; } else { img.alt = `Depoimento ${i + 1}`; img.loading = 'lazy'; }
      const bar = document.createElement('div');
      bar.className = 'gbar';
      const btn = (label, aria, fn, cls = '') => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.setAttribute('aria-label', aria);
        b.className = cls;
        b.onclick = fn;
        return b;
      };
      const move = (to) => () => {
        if (to < 0 || to >= g.items.length) return;
        [g.items[i], g.items[to]] = [g.items[to], g.items[i]];
        dirty = true;
        g.render();
      };
      bar.append(
        btn('←', 'Mover para antes', move(i - 1)),
        btn('→', 'Mover para depois', move(i + 1)),
        btn('✕', 'Remover imagem', () => { g.items.splice(i, 1); dirty = true; g.render(); }, 'danger'),
      );
      item.append(img, bar);
      return item;
    }));
  };
  g.set = (list) => { g.items = [...(list || [])]; g.render(); $(`#${p}gallery-err`).textContent = ''; };
  $(`#${p}gallery-input`).addEventListener('change', async (ev) => {
    const files = [...ev.target.files];
    ev.target.value = '';
    if (!files.length) return;
    const bar = $(`#${p}gallery-progress`);
    const err = $(`#${p}gallery-err`);
    const fails = [];
    err.textContent = '';
    bar.hidden = false;
    pending++;
    syncSave();
    for (const [n, file] of files.entries()) {
      try {
        if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(file.type)) throw new Error('formato não aceito (envie JPG, PNG, WEBP, GIF, MP4 ou WEBM)');
        const url = await uploadFile(file, 'media', (pc) => {
          bar.firstChild.style.width = ((n + pc / 100) / files.length) * 100 + '%';
        });
        g.items.push(url);
        dirty = true;
        g.render();
      } catch (ex) {
        fails.push(`${file.name}: ${ex.message}`);
      }
    }
    pending--;
    bar.hidden = true;
    bar.firstChild.style.width = '0';
    syncSave();
    if (fails.length) err.textContent = 'Não enviadas — ' + fails.join(' · ');
  });
  return g;
}
const gallery = makeGallery('');     // aba VSL
const sGallery = makeGallery('s-');  // aba Página de vendas

/* ---------- formulário ---------- */

/** 750 -> "12:30"; 3900 -> "1:05:00" */
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "12:30" / "1:05:00" / "90" -> segundos; null se inválido. */
function parseTime(txt) {
  txt = String(txt || '').trim();
  if (!txt) return 0;
  if (!/^\d{1,5}(:\d{1,2}){0,2}$/.test(txt)) return null;
  const parts = txt.split(':').map(Number);
  if (parts.slice(1).some((n) => n > 59)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function fill(d) {
  const f = $('#f').elements;
  for (const k of ['brand_name', 'badge', 'title', 'subtitle', 'testimonials_title', 'footer_text', 'disclaimer', 'head_code', 'meta_pixel_id']) f[k].value = d[k] ?? '';
  f.video_url.value = d.video.url;
  f.video_embed.value = d.video.embed;
  f.video_ratio.value = d.video.ratio;
  ($(`input[name=video_type][value="${d.video.type}"]`) || $('input[name=video_type]')).checked = true;
  f.cta_enabled.checked = d.cta.enabled;
  f.cta_text.value = d.cta.text;
  f.cta_url.value = d.cta.url;
  f.cta_pitch.value = fmtTime(d.cta.delay);
  f.cta_color.value = d.cta.color;
  f.cta_offer_text.value = d.cta.offer_text || '';
  f.cta_hide_below.checked = Boolean(d.cta.hide_below);
  $('#pitch-err').hidden = true;
  setupMedia($('[data-media=logo]'), d.logo);
  setupMedia($('[data-media=favicon]'), d.favicon);
  const xp = d.exit_popup || {};
  f.exit_enabled.checked = xp.enabled !== false;
  for (const k of ['delay', 'tag', 'title', 'text', 'offer_text', 'button', 'url', 'note']) f['exit_' + k].value = xp[k] ?? '';
  setupMedia($('[data-media=exit_image]'), xp.image);
  f.video_autoplay.checked = d.video.autoplay !== false;
  setupMedia($('[data-media=video_file]'), d.video.file);
  setupMedia($('[data-media=pause_image]'), d.video.pause_image);
  gallery.set(d.testimonial_images);
  $('#tlist').replaceChildren();
  d.testimonials.forEach(addRow);
  syncEmpty();
  fillSales(d.sales);
  fillUpsells(d.upsells);
  syncPanes();
  dirty = false;
}

function collect() {
  const f = $('#f').elements;
  const val = (k) => f[k].value;
  return {
    brand_name: val('brand_name'),
    logo: $('[data-media=logo]').dataset.value,
    favicon: $('[data-media=favicon]').dataset.value,
    exit_popup: {
      enabled: f.exit_enabled.checked,
      delay: Number(val('exit_delay')) || 0,
      tag: val('exit_tag'), title: val('exit_title'), text: val('exit_text'),
      offer_text: val('exit_offer_text'), button: val('exit_button'), url: val('exit_url').trim(),
      image: $('[data-media=exit_image]').dataset.value, note: val('exit_note'),
    },
    badge: val('badge'),
    title: val('title'),
    subtitle: val('subtitle'),
    video: {
      type: ($('input[name=video_type]:checked') || {}).value || 'url',
      url: val('video_url').trim(),
      file: $('[data-media=video_file]').dataset.value,
      embed: val('video_embed'),
      ratio: val('video_ratio'),
      autoplay: f.video_autoplay.checked,
      pause_image: $('[data-media=pause_image]').dataset.value,
    },
    cta: {
      enabled: f.cta_enabled.checked,
      text: val('cta_text'),
      url: val('cta_url').trim(),
      delay: parseTime(val('cta_pitch')) ?? 0,
      color: val('cta_color'),
      offer_text: val('cta_offer_text'),
      hide_below: f.cta_hide_below.checked,
    },
    testimonials_title: val('testimonials_title'),
    testimonial_images: gallery.items,
    testimonials: $$('#tlist .trow').map((row) => ({
      id: row.dataset.id,
      name: $('[data-f=name]', row).value,
      city: $('[data-f=city]', row).value,
      text: $('[data-f=text]', row).value,
      rating: Number($('[data-f=rating]', row).value),
      photo: $('[data-media=photo]', row).dataset.value,
      proof: $('[data-media=proof]', row).dataset.value,
    })),
    footer_text: val('footer_text'),
    disclaimer: val('disclaimer'),
    head_code: val('head_code'),
    meta_pixel_id: val('meta_pixel_id').trim(),
    sales: collectSales(),
    upsells: collectUpsells(),
  };
}

function syncPanes() {
  for (const [form, name, def] of [['#f', 'video_type', 'url'], ['#fs', 's_video_type', 'upload']]) {
    const v = ($(`input[name=${name}]:checked`) || {}).value || def;
    for (const p of $$('.pane', $(form))) p.hidden = p.dataset.pane !== v;
  }
  for (const pg of U_PAGES) {
    const v = ($(`input[name="${pg}.video_type"]:checked`) || {}).value || 'none';
    for (const p of $$('.pane', $(`[name="${pg}.video_type"]`).closest('.card'))) p.hidden = p.dataset.pane !== v;
  }
}

/* ---------- upsell e downsell ---------- */

const U_PAGES = ['upsell', 'downsell'];
const U_CHECKS = ['enabled'];

async function restoreUpsells(ask = true) {
  if (ask && !confirm('Preencher as páginas de upsell e downsell com o modelo original? O que você mudou nesta aba será substituído (só vale depois de Salvar).')) return;
  try {
    fillUpsells(await api('/api/content?defaults=upsells'));
    syncPanes();
    dirty = true;
    if (ask) flash($('#umsgs'), 'ok', 'Modelo original preenchido. Ajuste o que quiser e clique em Salvar alterações.');
  } catch (ex) {
    flash($('#umsgs'), 'err', 'Não foi possível carregar o modelo: ' + ex.message);
  }
}
$('#u-restore').addEventListener('click', () => restoreUpsells());
for (const c of $$('#tab-upsell .u-link')) c.textContent = location.origin + '/' + c.dataset.p;

function fillUpsells(u) {
  if (!u || !u.upsell) { restoreUpsells(false); return; }
  const f = $('#fu').elements;
  for (const pg of U_PAGES) {
    const t = u[pg] || {};
    for (const el of f) {
      if (!el.name || !el.name.startsWith(pg + '.') || el.name.includes('.video_')) continue;
      const k = el.name.slice(pg.length + 1);
      if (U_CHECKS.includes(k)) el.checked = Boolean(t[k]);
      else if (k in t) el.value = t[k] ?? '';
    }
    const v = t.video || {};
    ($(`input[name="${pg}.video_type"][value="${v.type}"]`) || $(`input[name="${pg}.video_type"][value=none]`)).checked = true;
    f[pg + '.video_url'].value = v.url || '';
    f[pg + '.video_embed'].value = v.embed || '';
    f[pg + '.video_ratio'].value = v.ratio || '9:16';
    f[pg + '.video_autoplay'].checked = Boolean(v.autoplay);
    setupMedia($(`[data-media="${pg}.video_file"]`), v.file);
  }
}

function collectUpsells() {
  const f = $('#fu').elements;
  const out = {};
  for (const pg of U_PAGES) {
    const t = {};
    for (const el of f) {
      if (!el.name || !el.name.startsWith(pg + '.') || el.name.includes('.video_')) continue;
      const k = el.name.slice(pg.length + 1);
      t[k] = U_CHECKS.includes(k) ? el.checked : el.value;
    }
    t.cta_url = (t.cta_url || '').trim();
    t.decline_url = (t.decline_url || '').trim();
    t.video = {
      type: ($(`input[name="${pg}.video_type"]:checked`) || {}).value || 'none',
      file: $(`[data-media="${pg}.video_file"]`).dataset.value,
      url: f[pg + '.video_url'].value.trim(),
      embed: f[pg + '.video_embed'].value,
      ratio: f[pg + '.video_ratio'].value,
      autoplay: f[pg + '.video_autoplay'].checked,
      pause_image: '',
    };
    out[pg] = t;
  }
  return out;
}

/* ---------- página de vendas ---------- */

const S_CHECKS = ['enabled', 'show_testimonials'];
const S_MEDIA = ['logo', 'favicon', 'img1', 'img2', 'product_image', 'results_image'];

async function restoreSales(ask = true) {
  if (ask && !confirm('Preencher todos os campos da página de vendas com o modelo original? O que você mudou nesta aba será substituído (só vale depois de Salvar).')) return;
  try {
    fillSales(await api('/api/content?defaults=sales'));
    dirty = true;
    if (ask) flash($('#smsgs'), 'ok', 'Modelo original preenchido. Ajuste o que quiser e clique em Salvar alterações.');
  } catch (ex) {
    flash($('#smsgs'), 'err', 'Não foi possível carregar o modelo: ' + ex.message);
  }
}
$('#s-restore').addEventListener('click', () => restoreSales());

function fillSales(t) {
  // Conteúdo sem a página de vendas (salvo antes dela existir): usa o modelo pronto.
  if (!t || !t.headline) { restoreSales(false); return; }
  const f = $('#fs').elements;
  for (const el of f) {
    if (!el.name || !el.name.startsWith('s_') || el.name.startsWith('s_video')) continue;
    const k = el.name.slice(2);
    if (S_CHECKS.includes(k)) el.checked = Boolean(t[k]);
    else if (k in t) el.value = t[k] ?? '';
  }
  const v = t.video || {};
  ($(`input[name=s_video_type][value="${v.type}"]`) || $('input[name=s_video_type][value=upload]')).checked = true;
  f.s_video_url.value = v.url || '';
  f.s_video_embed.value = v.embed || '';
  f.s_video_ratio.value = v.ratio || '9:16';
  f.s_video_autoplay.checked = v.autoplay !== false;
  setupMedia($('[data-media=s_video_file]'), v.file);
  setupMedia($('[data-media=s_pause_image]'), v.pause_image);
  for (const k of S_MEDIA) setupMedia($(`[data-media=s_${k}]`), t[k]);
  sGallery.set(t.testimonial_images);
}

function collectSales() {
  const f = $('#fs').elements;
  const out = {};
  for (const el of f) {
    if (!el.name || !el.name.startsWith('s_') || el.name.startsWith('s_video')) continue;
    const k = el.name.slice(2);
    out[k] = S_CHECKS.includes(k) ? el.checked : el.value;
  }
  out.cta_url = (out.cta_url || '').trim();
  for (const k of S_MEDIA) out[k] = $(`[data-media=s_${k}]`).dataset.value;
  out.testimonial_images = sGallery.items;
  out.video = {
    type: ($('input[name=s_video_type]:checked') || {}).value || 'upload',
    file: $('[data-media=s_video_file]').dataset.value,
    url: f.s_video_url.value.trim(),
    embed: f.s_video_embed.value,
    ratio: f.s_video_ratio.value,
    autoplay: f.s_video_autoplay.checked,
    pause_image: $('[data-media=s_pause_image]').dataset.value,
  };
  return out;
}

function warnings(d) {
  const out = [];
  if ($('#f').elements.cta_url.value.trim() && !/^https?:\/\//i.test(d.cta.url)) out.push('o link do botão precisa começar com https://');
  if (d.video.type === 'url' && d.video.url && !/^https?:\/\//i.test(d.video.url)) out.push('o link do vídeo precisa começar com https://');
  if ($('#fs').elements.s_cta_url.value.trim() && !/^https?:\/\//i.test(d.sales.cta_url)) out.push('o link do botão da página de vendas precisa começar com https://');
  for (const pg of U_PAGES) {
    const f = $('#fu').elements;
    if (f[pg + '.cta_url'].value.trim() && !d.upsells[pg].cta_url) out.push(`o link do checkout do ${pg} precisa começar com https://`);
    if (f[pg + '.decline_url'].value.trim() && !d.upsells[pg].decline_url) out.push(`o link do "não, obrigado" do ${pg} precisa começar com / ou https://`);
  }
  return out;
}

async function loadEditor() {
  show('view-editor');
  let d = await api('/api/content');
  // O CDN pode servir a versão anterior por até 1 min depois de salvar.
  try {
    const last = JSON.parse(localStorage.getItem(LAST_SAVED) || 'null');
    // A cópia local pode ser de antes da página de vendas existir: mantém a do servidor nesse caso.
    if (last && last.video && last.cta && last.updatedAt > (d.updatedAt || 0)) d = { ...last, sales: last.sales || d.sales, upsells: last.upsells || d.upsells };
  } catch {}
  fill(d);
  loadCapi();
  if (storageWarning) flash($('#msgs'), 'err', storageWarning);
}

/* ---------- API de Conversões do Meta (tokens ficam no banco, não no arquivo público) ---------- */

let capiS = null;
function renderCapi() {
  const box = $('#capi-rows');
  if (!capiS) return;
  const ids = $('#f').elements.meta_pixel_id.value.match(/\d{5,20}/g) || [];
  box.innerHTML = ids.map((id) => `<label>Token do pixel ${id} <small>${capiS.meta_tokens_set?.[id] ? `(configurado, termina em ${capiS.meta_tokens_set[id]}; vazio = manter, "-" = tirar)` : '(não configurado)'}</small><input type="password" data-pid="${id}" autocomplete="off" spellcheck="false" placeholder="EAA..."></label>`).join('')
    || '<p class="hint">Coloque os IDs do pixel no campo acima.</p>';
  $('#capi-test').value = capiS.meta_test_code || '';
  $('#capi-purchase').checked = capiS.capi_purchase !== false;
}
async function loadCapi() {
  try { capiS = await api('/api/area?a=settings'); renderCapi(); }
  catch (ex) { $('#capi-msg').textContent = 'A API de Conversões precisa do banco (Supabase) conectado: ' + ex.message; }
}
$('#f').elements.meta_pixel_id.addEventListener('input', () => renderCapi());
$('#capi-save').addEventListener('click', async () => {
  const meta_tokens = {};
  for (const inp of $$('#capi-rows input[data-pid]')) if (inp.value.trim()) meta_tokens[inp.dataset.pid] = inp.value.trim();
  const b = $('#capi-save'); b.disabled = true;
  try {
    capiS = await api('/api/area?a=settings', { method: 'PUT', headers: HDR, body: JSON.stringify({ meta_tokens, meta_test_code: $('#capi-test').value.trim(), capi_purchase: $('#capi-purchase').checked }) });
    renderCapi();
    $('#capi-msg').textContent = 'Salvo. ' + (Object.keys(capiS.meta_tokens_set || {}).length ? 'Os próximos cliques no botão e as compras aprovadas já vão para o pixel pelo servidor.' : 'Nenhum token configurado ainda.') + ' (Se mudou os IDs do pixel, salve também as alterações da página.)';
  } catch (ex) { $('#capi-msg').textContent = 'Erro: ' + ex.message; }
  finally { b.disabled = false; }
});

/* ---------- eventos ---------- */

$('#login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = $('#login-form button');
  btn.disabled = true;
  try {
    await api('/api/login', { method: 'POST', headers: HDR, body: JSON.stringify({ password: ev.target.elements.password.value }) });
    ev.target.reset();
    await loadEditor();
  } catch (ex) {
    flash($('#login-msg'), 'err', ex.message);
  } finally {
    btn.disabled = false;
  }
});

$('#logout').addEventListener('click', async () => {
  if (dirty && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
  await api('/api/logout', { method: 'POST', headers: HDR }).catch(() => {});
  dirty = false;
  show('view-login');
});

$('#tadd').addEventListener('click', () => {
  $('[data-f=name]', addRow()).focus();
  dirty = true;
});

$('#tlist').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-move], button[data-remove]');
  if (!btn) return;
  const row = btn.closest('.trow');
  const list = $('#tlist');
  if (btn.hasAttribute('data-remove')) {
    if (confirm('Excluir este depoimento?')) { row.remove(); syncEmpty(); dirty = true; }
  } else if (btn.dataset.move === '-1' && row.previousElementSibling) {
    list.insertBefore(row, row.previousElementSibling); btn.focus(); dirty = true;
  } else if (btn.dataset.move === '1' && row.nextElementSibling) {
    list.insertBefore(row.nextElementSibling, row); btn.focus(); dirty = true;
  }
});

$('#tlist').addEventListener('input', (ev) => {
  if (ev.target.matches('[data-f=name]')) $('.trow-title', ev.target.closest('.trow')).textContent = ev.target.value || 'Novo depoimento';
});

for (const form of ['#f', '#fs', '#fu']) {
  $(form).addEventListener('change', (ev) => {
    if (/video_type$/.test(ev.target.name)) syncPanes();
    dirty = true;
  });
  $(form).addEventListener('input', () => (dirty = true));
}

// As duas abas (VSL e página de vendas) salvam tudo junto, no mesmo arquivo.
$('#f').addEventListener('submit', (ev) => { ev.preventDefault(); save($('#msgs')); });
$('#fs').addEventListener('submit', (ev) => { ev.preventDefault(); save($('#smsgs')); });
$('#fu').addEventListener('submit', (ev) => { ev.preventDefault(); save($('#umsgs')); });

async function save(box) {
  if (pending > 0) return;
  const pitchOk = parseTime($('#f').elements.cta_pitch.value) !== null;
  $('#pitch-err').hidden = pitchOk;
  if (!pitchOk) {
    document.querySelector('.tab[data-tab=edit]').click();
    return $('#f').elements.cta_pitch.focus();
  }
  const data = collect();
  for (const b of $$('.savebtn')) { b.disabled = true; b.textContent = 'Salvando…'; }
  try {
    const saved = await api('/api/content', { method: 'PUT', headers: HDR, body: JSON.stringify(data) });
    try { localStorage.setItem(LAST_SAVED, JSON.stringify(saved)); } catch {}
    fill(saved);
    viewStamp = '?v=' + saved.updatedAt; // fura o cache do CDN
    $('#view-sales').href = '/oferta' + viewStamp;
    for (const a of $$('.view-up')) a.href = '/' + a.dataset.page + viewStamp;
    syncViewLink();
    const w = warnings(saved);
    flash(box, w.length ? 'err' : 'ok',
      w.length ? 'Salvo, mas ' + w.join(' e ') + '.' : 'Alterações salvas. A página pública atualiza em até 1 minuto.');
  } catch (ex) {
    if (ex.status === 401) {
      flash($('#login-msg'), 'err', ex.message);
      show('view-login');
    } else {
      flash(box, 'err', ex.message);
    }
  } finally {
    syncSave();
  }
}

// "Ver página" do topo abre a página da aba aberta: VSL ou página de vendas.
let viewStamp = '';
function syncViewLink() {
  const sales = !$('#tab-sales').hidden, area = !$('#tab-area').hidden, up = !$('#tab-upsell').hidden;
  const a = $('#view-page');
  a.href = area ? '/membros' : (up ? '/upsell' : sales ? '/oferta' : '/') + (viewStamp || (up ? '?v=1' : ''));
  a.textContent = area ? 'Ver área de membros ↗' : up ? 'Ver upsell ↗' : sales ? 'Ver página de vendas ↗' : 'Ver VSL ↗';
}
for (const b of $$('.tab')) b.addEventListener('click', () => setTimeout(syncViewLink));

window.addEventListener('beforeunload', (e) => {
  if (dirty || pending) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- início ---------- */

(async () => {
  try {
    const s = await api('/api/session');
    localUploads = s.localUploads;
    storageWarning = s.storageWarning || '';
    uploadModeName = s.uploadMode || 'presigned';
    if (!s.configured) return show('view-setup');
    if (!s.logged) return show('view-login');
    await loadEditor();
  } catch (ex) {
    show('view-login');
    flash($('#login-msg'), 'err', 'Não foi possível carregar: ' + ex.message);
  }
})();
