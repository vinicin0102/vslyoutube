// Aba "Área de membros" do painel: aulas, alunos, chat do auxiliar e webhook.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const HDR = { 'content-type': 'application/json', 'x-vsl': '1' };
const isVideo = (u) => /\.(mp4|webm)(\?|#|$)/i.test(u || '');
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join('');

async function api(a, opts = {}) {
  const res = await fetch('/api/area?a=' + a, { credentials: 'same-origin', ...opts, headers: { ...HDR, ...(opts.headers || {}) } });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || 'Erro ' + res.status);
  return data;
}
function flash(type, text) {
  const box = $('#amsgs');
  const d = document.createElement('div');
  d.className = 'flash ' + type; d.setAttribute('role', type === 'err' ? 'alert' : 'status'); d.textContent = text;
  box.replaceChildren(d);
  d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  if (type === 'ok') setTimeout(() => d.remove(), 5000);
}

let loaded = false, course = null, settings = null, courseDirty = false;

/* ---------- curso ---------- */

const upload = (file, kind, onP) => window.vslUpload(file, kind, onP);

function mediaBox(path, url, kind, label) {
  const thumb = url ? (isVideo(url) ? `<video src="${esc(url)}" muted preload="metadata" class="thumb"></video>` : /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) ? `<img src="${esc(url)}" class="thumb" alt="">` : `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.split('/').pop())}</a>`) : '';
  return `<div class="cmedia" data-up="${path}" data-kind="${kind}"><span class="media-label">${label}</span>
    ${url ? `<div class="media-current">${thumb}<button type="button" class="small danger" data-clear="${path}">Remover</button></div>` : ''}
    <input type="file" accept="${kind === 'video' ? 'video/mp4,video/webm' : kind === 'doc' ? 'application/pdf' : 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm'}">
    <div class="progress" hidden><div></div></div><div class="media-err"></div></div>`;
}

function lessonHtml(l, mi, li, n) {
  const p = `m.${mi}.l.${li}`, v = l.video;
  return `<details class="cles" ${l._open ? 'open' : ''} data-open="${p}">
    <summary><b>${li + 1}. ${esc(l.title)}</b> <small class="hint">${v.type === 'none' ? (l.text ? 'texto' : 'sem vídeo') : v.type === 'upload' ? (v.file ? 'vídeo enviado' : 'sem vídeo') : v.type === 'url' ? 'link' : 'código do player'}</small>
      <span class="trow-actions"><button type="button" class="icon" data-act="lup" data-p="${mi}.${li}" aria-label="Subir aula">↑</button><button type="button" class="icon" data-act="ldown" data-p="${mi}.${li}" aria-label="Descer aula">↓</button><button type="button" class="icon danger" data-act="ldel" data-p="${mi}.${li}" aria-label="Excluir aula">✕</button></span></summary>
    <label>Título da aula<input data-k="${p}.title" value="${esc(l.title)}" maxlength="160"></label>
    <label>Descrição <small>(opcional)</small><input data-k="${p}.description" value="${esc(l.description)}" maxlength="1000"></label>
    <div class="seg">${[['none', 'Sem vídeo'], ['upload', 'Enviar vídeo'], ['url', 'Link'], ['embed', 'Código do player']].map(([k, t]) => `<label><input type="radio" name="vt-${p}" data-k="${p}.video.type" value="${k}" ${v.type === k ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
    ${v.type === 'upload' ? mediaBox(`${p}.video.file`, v.file, 'video', 'Vídeo da aula <small>(MP4 ou WEBM)</small>') : ''}
    ${v.type === 'url' ? `<label>Link do vídeo <small>(YouTube, Vimeo ou .mp4)</small><input type="url" data-k="${p}.video.url" value="${esc(v.url)}" placeholder="https://"></label>` : ''}
    ${v.type === 'embed' ? `<label>Código do player<textarea class="code" rows="4" data-k="${p}.video.embed">${esc(v.embed)}</textarea></label>` : ''}
    <label>Texto da aula <small>(opcional: receita, ingredientes, passo a passo. **negrito**, linhas com "- " viram lista)</small><textarea rows="4" data-k="${p}.text">${esc(l.text)}</textarea></label>
    <label>Materiais <small>(um por linha: Nome | link)</small><textarea rows="2" data-k="${p}.materialsText" placeholder="Receita em PDF | https://...">${esc(l.materials.map((x) => `${x.label} | ${x.url}`).join('\n'))}</textarea></label>
    ${mediaBox(`${p}.materials+`, '', 'doc', 'Enviar PDF para os materiais')}
  </details>`;
}

function moduleHtml(m, mi) {
  const p = `m.${mi}`;
  return `<details class="cmod" ${m._open ? 'open' : ''} data-open="${p}">
    <summary><b>${m.bonus ? '🎁' : '📚'} ${esc(m.title)}</b> <small class="hint">${m.lessons.length} aula${m.lessons.length === 1 ? '' : 's'}</small>
      <span class="trow-actions"><button type="button" class="icon" data-act="mup" data-p="${mi}" aria-label="Subir módulo">↑</button><button type="button" class="icon" data-act="mdown" data-p="${mi}" aria-label="Descer módulo">↓</button><button type="button" class="icon danger" data-act="mdel" data-p="${mi}" aria-label="Excluir módulo">✕</button></span></summary>
    <label>Nome do módulo<input data-k="${p}.title" value="${esc(m.title)}" maxlength="160"></label>
    <label>Descrição curta<input data-k="${p}.description" value="${esc(m.description)}" maxlength="400"></label>
    <label class="inline"><input type="checkbox" data-k="${p}.bonus" ${m.bonus ? 'checked' : ''}> É um bônus (aparece em "Bônus exclusivos")</label>
    ${mediaBox(`${p}.cover`, m.cover, 'media', 'Capa do módulo <small>(imagem ou vídeo curto; opcional)</small>')}
    <div class="cles-list">${m.lessons.map((l, li) => lessonHtml(l, mi, li)).join('')}</div>
    <button type="button" class="add" data-act="ladd" data-p="${mi}">+ Adicionar aula</button>
  </details>`;
}

function renderCourse() {
  $('#c-box').innerHTML = course.modules.map(moduleHtml).join('') || '<p class="empty">Nenhum módulo ainda.</p>';
}

function getPath(path) {
  const parts = path.split('.');
  let o = course, key;
  const map = (k) => (k === 'm' ? 'modules' : k === 'l' ? 'lessons' : k);
  for (let i = 0; i < parts.length - 1; i++) o = o[map(parts[i])];
  key = map(parts[parts.length - 1]);
  return [o, key];
}
function setPath(path, value) {
  const [o, key] = getPath(path);
  if (key === 'materialsText') {
    o.materials = String(value).split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.lastIndexOf('|'); return i < 0 ? { label: 'Material', url: l } : { label: l.slice(0, i).trim() || 'Material', url: l.slice(i + 1).trim() }; });
  } else o[key] = value;
  courseDirty = true;
}

function rememberOpen() {
  for (const d of $$('#c-box details[data-open]')) { const [o] = [d.dataset.open]; const [obj, key] = getPath(o + '.x'); obj._open = d.open; }
}

$('#c-box').addEventListener('input', (e) => {
  const k = e.target.dataset.k;
  if (!k || e.target.type === 'radio' || e.target.type === 'checkbox') return;
  setPath(k, e.target.value);
  if (k.endsWith('.title')) { const s = e.target.closest('details').querySelector('summary b'); if (s) s.textContent = (s.textContent.match(/^(\d+\. |🎁 |📚 )/) || [''])[0] + e.target.value; }
});
$('#c-box').addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.k && (t.type === 'radio' || t.type === 'checkbox')) {
    setPath(t.dataset.k, t.type === 'checkbox' ? t.checked : t.value);
    rememberOpen(); renderCourse(); return;
  }
  if (t.type === 'file') {
    const box = t.closest('[data-up]'), file = t.files[0];
    if (!file) return;
    const err = $('.media-err', box), bar = $('.progress', box);
    err.textContent = ''; bar.hidden = false;
    try {
      const url = await upload(file, box.dataset.kind, (p) => (bar.firstChild.style.width = p + '%'));
      const path = box.dataset.up;
      if (path.endsWith('.materials+')) {
        const [o] = getPath(path.replace('.materials+', '.x'));
        o.materials.push({ label: file.name.replace(/\.pdf$/i, ''), url });
        courseDirty = true;
      } else setPath(path, url);
      rememberOpen(); renderCourse();
    } catch (ex) {
      err.textContent = 'Falha no envio: ' + ex.message;
    } finally { bar.hidden = true; t.value = ''; }
  }
});
$('#c-box').addEventListener('click', (e) => {
  const clr = e.target.closest('[data-clear]');
  if (clr) { setPath(clr.dataset.clear, ''); rememberOpen(); renderCourse(); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  e.preventDefault();
  rememberOpen();
  const [mi, li] = b.dataset.p.split('.').map(Number), mods = course.modules;
  const swap = (arr, i, j) => { if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  if (b.dataset.act === 'mup') swap(mods, mi, mi - 1);
  if (b.dataset.act === 'mdown') swap(mods, mi, mi + 1);
  if (b.dataset.act === 'mdel' && confirm(`Excluir o módulo "${mods[mi].title}" e todas as aulas dele?`)) mods.splice(mi, 1);
  if (b.dataset.act === 'ladd') { mods[mi].lessons.push({ id: rid(), title: 'Nova aula', description: '', video: { type: 'upload', file: '', url: '', embed: '' }, text: '', materials: [], _open: true }); mods[mi]._open = true; }
  if (b.dataset.act === 'lup') swap(mods[mi].lessons, li, li - 1);
  if (b.dataset.act === 'ldown') swap(mods[mi].lessons, li, li + 1);
  if (b.dataset.act === 'ldel' && confirm(`Excluir a aula "${mods[mi].lessons[li].title}"?`)) mods[mi].lessons.splice(li, 1);
  courseDirty = true;
  renderCourse();
});
$('#c-addmod').addEventListener('click', () => {
  rememberOpen();
  course.modules.push({ id: rid(), title: 'Novo módulo', description: '', cover: '', bonus: false, lessons: [], _open: true });
  courseDirty = true; renderCourse();
});
$('#c-save').addEventListener('click', async () => {
  const btn = $('#c-save');
  btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    rememberOpen();
    const open = new Map(course.modules.flatMap((m) => [[m.id, m._open], ...m.lessons.map((l) => [l.id, l._open])]));
    course = await api('course', { method: 'PUT', body: JSON.stringify(course) });
    for (const m of course.modules) { m._open = open.get(m.id); for (const l of m.lessons) l._open = open.get(l.id); }
    renderCourse(); courseDirty = false;
    flash('ok', 'Aulas salvas. Os alunos já veem a versão nova.');
  } catch (ex) { flash('err', ex.message); } finally { btn.disabled = false; btn.textContent = 'Salvar aulas'; }
});

/* ---------- alunos ---------- */

const fmtDate = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
async function loadMembers() {
  const t = $('#m-table');
  try {
    const r = await api('members&q=' + encodeURIComponent($('#m-q').value.trim()));
    $('#m-count').textContent = `(${r.total} no total)`;
    t.innerHTML = `<thead><tr><th>Aluno</th><th>Situação</th><th>Último acesso</th><th>Ações</th></tr></thead><tbody>${r.members.map((m) => `<tr>
      <td><b>${esc(m.email)}</b>${m.name ? `<br><small class="hint">${esc(m.name)}</small>` : ''}<br><small class="hint">${m.source === 'webhook' ? 'compra' : 'manual'} · ${fmtDate(m.created_at)}</small></td>
      <td>${m.active ? '<span style="color:#22c55e">ativo</span>' : '<span style="color:#ef4444">bloqueado</span>'}<br><small class="hint">${m.has_password ? 'senha criada' : 'ainda não entrou'}</small></td>
      <td>${fmtDate(m.last_login)}</td>
      <td><select data-email="${esc(m.email)}" aria-label="Ação para ${esc(m.email)}"><option value="">Escolher…</option>${m.active ? '<option value="deactivate">Bloquear acesso</option>' : '<option value="activate">Liberar acesso</option>'}<option value="reset">Zerar senha</option><option value="delete">Excluir</option></select></td>
    </tr>`).join('') || '<tr><td colspan="4" class="hint">Nenhum aluno ainda.</td></tr>'}</tbody>`;
  } catch (ex) { t.innerHTML = ''; flash('err', ex.message); }
}
$('#m-table').addEventListener('change', async (e) => {
  const s = e.target.closest('select[data-email]');
  if (!s || !s.value) return;
  const labels = { deactivate: 'bloquear o acesso de', activate: 'liberar o acesso de', reset: 'zerar a senha de', delete: 'excluir' };
  if (!confirm(`Confirmar: ${labels[s.value]} ${s.dataset.email}?${s.value === 'reset' ? '\n\nNo próximo acesso a pessoa cria uma senha nova.' : ''}`)) { s.value = ''; return; }
  try { await api('member', { method: 'POST', body: JSON.stringify({ email: s.dataset.email, op: s.value }) }); flash('ok', 'Pronto.'); loadMembers(); }
  catch (ex) { flash('err', ex.message); s.value = ''; }
});
$('#m-add-btn').addEventListener('click', async () => {
  const lines = $('#m-add').value.trim();
  if (!lines) return;
  try {
    const r = await api('members-add', { method: 'POST', body: JSON.stringify({ lines }) });
    $('#m-add').value = '';
    flash(r.invalid.length ? 'err' : 'ok', `${r.added} liberado(s)${r.existing ? `, ${r.existing} já tinha(m) acesso` : ''}.${r.invalid.length ? ' E-mails inválidos: ' + r.invalid.join(', ') : ''}`);
    loadMembers();
  } catch (ex) { flash('err', ex.message); }
});
let qTimer;
$('#m-q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(loadMembers, 300); });
$('#m-reload').addEventListener('click', loadMembers);

/* ---------- chat e webhook ---------- */

function fillSettings(s) {
  settings = s;
  $('#s-key').value = '';
  $('#s-keyinfo').textContent = s.ai_key_set ? `(configurada, termina em ${s.ai_key_hint}; deixe vazio para manter)` : '(ainda não configurada)';
  $('#s-model').innerHTML = Object.entries(s.models).map(([k, v]) => `<option value="${k}" ${k === s.ai_model ? 'selected' : ''}>${esc(v)}</option>`).join('');
  $('#s-limit').value = s.chat_limit;
  $('#s-name').value = s.assistant_name;
  $('#s-instr').value = s.instructions;
  $('#s-support').value = s.support;
  $('#a-hook').value = `${location.origin}/api/membros?a=webhook&token=${s.webhook_token}`;
  $('#s-appname').value = s.app_name || '';
  appIcon = s.app_icon || ''; paintAppIcon();
}
let appIcon = '';
function paintAppIcon() {
  const box = $('#s-appicon');
  box.querySelectorAll(':scope > :not(.media-label)').forEach((n) => n.remove());
  box.insertAdjacentHTML('beforeend', `${appIcon ? `<div class="media-current"><img class="thumb" src="${esc(appIcon)}" alt="" style="border-radius:22%"><button type="button" class="small danger" id="s-appicon-rm">Remover</button></div>` : ''}<input type="file" accept="image/png,image/jpeg,image/webp"><div class="progress" hidden><div></div></div><div class="media-err"></div>`);
}
$('#s-appicon').addEventListener('click', (e) => { if (e.target.id === 's-appicon-rm') { appIcon = ''; paintAppIcon(); } });
$('#s-appicon').addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const box = $('#s-appicon'), bar = $('.progress', box), err = $('.media-err', box);
  bar.hidden = false; err.textContent = '';
  try { appIcon = await upload(f, 'image', (p) => (bar.firstChild.style.width = p + '%')); paintAppIcon(); }
  catch (ex) { err.textContent = 'Falha no envio: ' + ex.message; bar.hidden = true; }
});
$('#s-appsave').addEventListener('click', async () => {
  try { await saveSettings({ app_name: $('#s-appname').value, app_icon: appIcon }); flash('ok', 'App salvo. Quem instalar daqui pra frente já recebe o nome e o ícone novos.'); }
  catch (ex) { flash('err', ex.message); }
});
async function saveSettings(extra = {}) {
  const body = { ai_key: $('#s-key').value.trim(), ai_model: $('#s-model').value, chat_limit: Number($('#s-limit').value), assistant_name: $('#s-name').value, instructions: $('#s-instr').value, support: $('#s-support').value, ...extra };
  fillSettings(await api('settings', { method: 'PUT', body: JSON.stringify(body) }));
}
$('#s-save').addEventListener('click', async () => {
  const k = $('#s-key').value.trim();
  if (k && !/^sk-ant-/.test(k) && !confirm('A chave da Anthropic normalmente começa com "sk-ant-". Salvar mesmo assim?')) return;
  try { await saveSettings(); flash('ok', 'Chat salvo.'); } catch (ex) { flash('err', ex.message); }
});
$('#s-delkey').addEventListener('click', async () => {
  if (!confirm('Apagar a chave da API? O chat dos alunos para de funcionar até você colar outra.')) return;
  try { await saveSettings({ ai_key: '-' }); flash('ok', 'Chave apagada.'); } catch (ex) { flash('err', ex.message); }
});
$('#s-test').addEventListener('click', async () => {
  const b = $('#s-test');
  b.disabled = true; b.textContent = 'Testando…';
  try {
    if ($('#s-key').value.trim()) await saveSettings();
    const r = await api('test-key', { method: 'POST' });
    flash('ok', 'Chave funcionando. Resposta do auxiliar: ' + r.reply);
  } catch (ex) { flash('err', 'O teste falhou: ' + ex.message); } finally { b.disabled = false; b.textContent = 'Testar chave'; }
});
$('#a-hook-new').addEventListener('click', async () => {
  if (!confirm('Gerar um link novo? O link antigo para de funcionar, e você precisa colar o novo na plataforma de vendas.')) return;
  try { await saveSettings({ new_webhook_token: true }); flash('ok', 'Link novo gerado. Atualize na plataforma de vendas.'); } catch (ex) { flash('err', ex.message); }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  const inp = document.getElementById(b.dataset.copy);
  navigator.clipboard?.writeText(inp.value).then(() => { b.textContent = 'Copiado!'; setTimeout(() => (b.textContent = 'Copiar'), 1500); }, () => inp.select());
});

/* ---------- carregamento (ao abrir a aba) ---------- */

async function load() {
  loaded = true;
  $('#a-link').value = location.origin + '/membros';
  $('#a-link-text').textContent = location.origin + '/membros';
  try {
    const [c, s] = await Promise.all([api('course'), api('settings')]);
    course = c; renderCourse(); fillSettings(s);
    loadMembers();
  } catch (ex) { loaded = false; flash('err', ex.message); }
}
for (const b of $$('.tab')) b.addEventListener('click', () => { if (b.dataset.tab === 'area' && !loaded) load(); });
window.addEventListener('beforeunload', (e) => { if (courseDirty) { e.preventDefault(); e.returnValue = ''; } });
