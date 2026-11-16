const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const HDR = { 'content-type': 'application/json', 'x-vsl': '1' };
const LAST_SAVED = 'vsl_last_saved';

let localUploads = false;
let storageWarning = '';
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
  const blob = await blobClient.upload('vsl/uploads/' + safe, file, {
    access: 'public',
    handleUploadUrl: '/api/upload',
    clientPayload: kind,
    headers: { 'x-vsl': '1' },
    multipart: file.size > 50 * 1024 * 1024,
    onUploadProgress: (p) => onProgress(p.percentage),
  });
  return blob.url;
}

/** Campo de mídia: miniatura do arquivo atual, botão remover e seletor de arquivo. */
function setupMedia(el, url) {
  const kind = el.dataset.kind;
  el.dataset.value = url || '';
  el.querySelectorAll(':scope > :not(.media-label)').forEach((n) => n.remove());

  const current = document.createElement('div');
  current.className = 'media-current';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = kind === 'video' ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp,image/gif';
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
    if (kind === 'video') {
      thumb = document.createElement('video');
      thumb.muted = true;
      thumb.preload = 'metadata';
    } else {
      thumb = document.createElement('img');
      thumb.alt = '';
    }
    thumb.src = v;
    thumb.className = 'thumb' + ('round' in el.dataset ? ' round' : '') + (el.dataset.media === 'logo' ? ' logo' : '');
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
    bar.hidden = false;
    bar.firstChild.style.width = '0';
    pending++;
    syncSave();
    try {
      el.dataset.value = await uploadFile(file, kind, (p) => (bar.firstChild.style.width = p + '%'));
      dirty = true;
      if (el.dataset.media === 'video_file') $('input[name=video_type][value=upload]').checked = true;
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
  const b = $('#save');
  b.disabled = pending > 0;
  b.textContent = pending > 0 ? 'Aguardando envio…' : 'Salvar alterações';
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

/* ---------- formulário ---------- */

function fill(d) {
  const f = $('#f').elements;
  for (const k of ['brand_name', 'badge', 'title', 'subtitle', 'testimonials_title', 'footer_text', 'disclaimer', 'head_code']) f[k].value = d[k] ?? '';
  f.video_url.value = d.video.url;
  f.video_embed.value = d.video.embed;
  f.video_ratio.value = d.video.ratio;
  ($(`input[name=video_type][value="${d.video.type}"]`) || $('input[name=video_type]')).checked = true;
  f.cta_enabled.checked = d.cta.enabled;
  f.cta_text.value = d.cta.text;
  f.cta_url.value = d.cta.url;
  f.cta_delay.value = d.cta.delay;
  f.cta_color.value = d.cta.color;
  setupMedia($('[data-media=logo]'), d.logo);
  setupMedia($('[data-media=video_file]'), d.video.file);
  $('#tlist').replaceChildren();
  d.testimonials.forEach(addRow);
  syncEmpty();
  syncPanes();
  dirty = false;
}

function collect() {
  const f = $('#f').elements;
  const val = (k) => f[k].value;
  return {
    brand_name: val('brand_name'),
    logo: $('[data-media=logo]').dataset.value,
    badge: val('badge'),
    title: val('title'),
    subtitle: val('subtitle'),
    video: {
      type: ($('input[name=video_type]:checked') || {}).value || 'url',
      url: val('video_url').trim(),
      file: $('[data-media=video_file]').dataset.value,
      embed: val('video_embed'),
      ratio: val('video_ratio'),
    },
    cta: {
      enabled: f.cta_enabled.checked,
      text: val('cta_text'),
      url: val('cta_url').trim(),
      delay: Number(val('cta_delay')) || 0,
      color: val('cta_color'),
    },
    testimonials_title: val('testimonials_title'),
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
  };
}

function syncPanes() {
  const v = ($('input[name=video_type]:checked') || {}).value || 'url';
  for (const p of $$('.pane')) p.hidden = p.dataset.pane !== v;
}

function warnings(d) {
  const out = [];
  if ($('#f').elements.cta_url.value.trim() && !/^https?:\/\//i.test(d.cta.url)) out.push('o link do botão precisa começar com https://');
  if (d.video.type === 'url' && d.video.url && !/^https?:\/\//i.test(d.video.url)) out.push('o link do vídeo precisa começar com https://');
  return out;
}

async function loadEditor() {
  show('view-editor');
  let d = await api('/api/content');
  // O CDN pode servir a versão anterior por até 1 min depois de salvar.
  try {
    const last = JSON.parse(localStorage.getItem(LAST_SAVED) || 'null');
    if (last && last.updatedAt > (d.updatedAt || 0)) d = last;
  } catch {}
  fill(d);
  if (storageWarning) flash($('#msgs'), 'err', storageWarning);
}

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

$('#f').addEventListener('change', (ev) => {
  if (ev.target.name === 'video_type') syncPanes();
  dirty = true;
});
$('#f').addEventListener('input', () => (dirty = true));

$('#f').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (pending > 0) return;
  const data = collect();
  const btn = $('#save');
  btn.disabled = true;
  btn.textContent = 'Salvando…';
  try {
    const saved = await api('/api/content', { method: 'PUT', headers: HDR, body: JSON.stringify(data) });
    try { localStorage.setItem(LAST_SAVED, JSON.stringify(saved)); } catch {}
    fill(saved);
    $('#view-page').href = '/?v=' + saved.updatedAt; // fura o cache do CDN
    const w = warnings(data);
    flash($('#msgs'), w.length ? 'err' : 'ok',
      w.length ? 'Salvo, mas ' + w.join(' e ') + '.' : 'Alterações salvas. A página pública atualiza em até 1 minuto.');
  } catch (ex) {
    if (ex.status === 401) {
      flash($('#login-msg'), 'err', ex.message);
      show('view-login');
    } else {
      flash($('#msgs'), 'err', ex.message);
    }
  } finally {
    syncSave();
  }
});

window.addEventListener('beforeunload', (e) => {
  if (dirty || pending) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- início ---------- */

(async () => {
  try {
    const s = await api('/api/session');
    localUploads = s.localUploads;
    storageWarning = s.storageWarning || '';
    if (!s.configured) return show('view-setup');
    if (!s.logged) return show('view-login');
    await loadEditor();
  } catch (ex) {
    show('view-login');
    flash($('#login-msg'), 'err', 'Não foi possível carregar: ' + ex.message);
  }
})();
