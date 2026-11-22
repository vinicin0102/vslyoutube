// App da área de membros: login, aulas, progresso e chat do auxiliar.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const isVideo = (u) => /\.(mp4|webm)(\?|#|$)/i.test(u || '');

let me = null, course = null;

async function api(a, opts = {}) {
  const res = await fetch('/api/membros?a=' + a, { credentials: 'same-origin', ...opts, headers: { 'content-type': 'application/json', 'x-m': '1', ...(opts.headers || {}) } });
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401 && data.login) { showLogin(); throw Object.assign(new Error(data.error || 'Entre de novo.'), { login: true }); }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Erro ' + res.status), { status: res.status, data });
  return data;
}

/* ---------- texto formatado (**negrito**, ==destaque==, listas) ---------- */
function rich(t) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/==(.+?)==/g, '<mark>$1</mark>').replace(/\n/g, '<br>');
  return String(t || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => {
    const ls = b.split('\n');
    if (ls.every((l) => /^\s*[-•]\s+/.test(l))) return '<ul>' + ls.map((l) => '<li>' + inline(l.replace(/^\s*[-•]\s+/, '')) + '</li>').join('') + '</ul>';
    return '<p>' + inline(b) + '</p>';
  }).join('');
}

/* ---------- progresso (no aparelho do aluno) ---------- */
const progKey = () => 'prog:' + (me?.email || '');
function done() { try { return new Set(JSON.parse(localStorage.getItem(progKey()) || '[]')); } catch { return new Set(); } }
function setDone(id, on) { const s = done(); on ? s.add(id) : s.delete(id); try { localStorage.setItem(progKey(), JSON.stringify([...s])); } catch {} }
const allLessons = () => course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, mod: m })));

/* ---------- app instalável (PWA) ---------- */
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ua = navigator.userAgent;
const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = /FBAN|FBAV|Instagram|Line\/|TikTok|musical_ly/i.test(ua); // navegador dentro do Instagram/Facebook não instala
let installEvt = null, appIcon = '/media/app-apple-180.png';
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/membros-sw.js', { scope: '/membros' }).catch(() => {}));
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; refreshInstall(); });
addEventListener('appinstalled', () => { installEvt = null; refreshInstall(); });
const dismissed = () => { try { return Date.now() - Number(localStorage.getItem('install-x') || 0) < 3 * 864e5; } catch { return false; } };
const canOfferInstall = () => !standalone();
function refreshInstall() {
  const l = $('#login-install'); if (l) l.hidden = !canOfferInstall();
  const card = $('#install'); if (card) card.hidden = !canOfferInstall() || dismissed();
}
function installCard() {
  if (!canOfferInstall() || dismissed()) return '';
  return `<div class="card install" id="install"><img src="${esc(appIcon)}" alt=""><div style="flex:1"><b>Instale o app</b><span class="muted sm">Ícone na tela do celular e acesso com um toque</span></div><button type="button" class="go" data-install>Instalar</button><button type="button" class="x" data-install-x aria-label="Agora não">✕</button></div>`;
}
async function doInstall() {
  if (installEvt) {
    installEvt.prompt();
    const r = await installEvt.userChoice.catch(() => null);
    installEvt = null; refreshInstall();
    if (r?.outcome === 'accepted') return;
  }
  // Sem o aviso automático do navegador: mostra o passo a passo.
  const steps = $('#sheet-steps');
  if (inApp) {
    $('#sheet-sub').textContent = 'Você abriu pelo navegador do Instagram/Facebook, que não instala apps. Faça assim:';
    steps.innerHTML = `<li>Toque nos <b>três pontinhos</b> <span class="ico">⋯</span> no canto da tela</li><li>Escolha <b>${isIOS ? 'Abrir no Safari' : 'Abrir no Chrome'}</b> (ou "Abrir no navegador")</li><li>Entre de novo e toque em <b>Instalar o app</b></li>`;
  } else if (isIOS) {
    $('#sheet-sub').textContent = 'No iPhone, a instalação é pelo Safari, em 3 toques:';
    steps.innerHTML = `<li>Toque no botão <b>Compartilhar</b> <span class="ico">⬆︎</span> na barra do Safari</li><li>Role e toque em <b>Adicionar à Tela de Início</b> <span class="ico">＋</span></li><li>Toque em <b>Adicionar</b>. Pronto: o app aparece na sua tela inicial 🐶</li>`;
  } else {
    $('#sheet-sub').textContent = 'No Android, pelo Chrome:';
    steps.innerHTML = `<li>Toque nos <b>três pontinhos</b> <span class="ico">⋮</span> no canto de cima</li><li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b></li><li>Confirme em <b>Instalar</b>. O ícone aparece junto com seus outros apps 🐶</li>`;
  }
  $('#sheet').hidden = false;
  $('#sheet-ok').focus();
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-install], #login-install')) { e.preventDefault(); doInstall(); }
  if (e.target.closest('[data-install-x]')) { try { localStorage.setItem('install-x', String(Date.now())); } catch {} refreshInstall(); }
  if (e.target.id === 'sheet-ok' || e.target.id === 'sheet') $('#sheet').hidden = true;
});
fetch('/api/membros?a=app').then((r) => r.json()).then((a) => {
  if (a.apple) { appIcon = a.apple; $('#apple-icon').href = a.apple; }
  if (a.name) { document.title = a.name; $('meta[name="apple-mobile-web-app-title"]').content = a.short || a.name; }
}).catch(() => {});

/* ---------- login ---------- */
let loginStep = 'email';
function showLogin() {
  $('#app').hidden = true; $('#nav').hidden = true; $('#login').hidden = false;
  $('#login-help').innerHTML = me?.support ? 'Precisa de ajuda? ' + esc(me.support) : 'Ainda não tem acesso? Use o mesmo e-mail da compra.';
  refreshInstall();
}
function setStep(step) {
  loginStep = step;
  const f = $('#login-form');
  $('#pw-wrap').hidden = step === 'email';
  if (step === 'first') {
    $('#login-title').textContent = 'Crie sua senha';
    $('#login-sub').textContent = 'É o seu primeiro acesso. Crie uma senha de pelo menos 6 caracteres para entrar das próximas vezes.';
    $('#pw-label').textContent = 'Nova senha'; f.password.autocomplete = 'new-password';
    $('#login-btn').textContent = 'Criar senha e entrar';
  } else if (step === 'password') {
    $('#login-title').textContent = 'Bem-vindo de volta';
    $('#login-sub').textContent = 'Digite sua senha para entrar.';
    $('#pw-label').textContent = 'Senha'; f.password.autocomplete = 'current-password';
    $('#login-btn').textContent = 'Entrar';
  }
  if (step !== 'email') setTimeout(() => f.password.focus(), 50);
}
$('#login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target, msg = $('#login-msg'), btn = $('#login-btn');
  msg.hidden = true; btn.disabled = true;
  try {
    const r = await api('login', { method: 'POST', body: JSON.stringify({ email: f.email.value, password: loginStep === 'email' ? '' : f.password.value }) });
    if (r.first && !r.ok) setStep('first');
    else if (r.needPassword) setStep('password');
    else if (r.ok) { f.reset(); setStep('email'); await boot(); }
  } catch (ex) {
    msg.textContent = ex.message; msg.hidden = false;
    if (ex.data?.first) setStep('first');
  } finally { btn.disabled = false; }
});

/* ---------- telas ---------- */
const view = () => $('#view');
function setTab(tab, back) {
  for (const a of $$('.nav a')) a.toggleAttribute('aria-current', a.dataset.tab === tab);
  $('#back').hidden = !back;
}
$('#back').addEventListener('click', () => (history.length > 1 ? history.back() : (location.hash = '#/')));

function modCard(m) {
  const d = done(), total = m.lessons.length, ok = m.lessons.filter((l) => d.has(l.id)).length;
  const cover = m.cover ? (isVideo(m.cover) ? `<video src="${esc(m.cover)}" autoplay muted loop playsinline></video>` : `<img src="${esc(m.cover)}" alt="" loading="lazy">`) : '';
  return `<a class="mod${m.bonus ? ' bonus' : ''}" href="#/m/${m.id}">${cover}${cover ? '' : `<span class="em" aria-hidden="true">${m.bonus ? '🎁' : '🦴'}</span>`}
    ${total ? `<span class="done">${ok}/${total}</span>` : ''}<b>${esc(m.title)}</b><span>${esc(m.description)}</span></a>`;
}

function home() {
  setTab('home');
  const d = done(), all = allLessons(), main = all.filter((l) => !l.mod.bonus);
  const ok = main.filter((l) => d.has(l.id)).length, pct = main.length ? Math.round((ok / main.length) * 100) : 0;
  const next = all.find((l) => !d.has(l.id)) || all[0];
  const first = (me.name || '').split(' ')[0];
  view().innerHTML = `<main>
    <h1>Olá${first ? ', ' + esc(first) : ''}! 🐶</h1>
    <p class="muted sm" style="margin:2px 0 0">${esc(course.welcome)}</p>
    ${installCard()}
    <div class="card prog"><div class="row"><span>Seu progresso no guia</span><b>${pct}%</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>
    ${next ? `<a class="card cont" href="#/a/${next.mod.id}/${next.id}"><div class="thumb"></div><div class="info"><span class="kick">${d.has(next.id) ? 'Rever aula' : 'Continuar assistindo'}</span><b>${esc(next.title)}</b><span class="muted sm">${esc(next.mod.title)}</span></div></a>` : ''}
    <h2>Módulos</h2>
    <div class="grid">${course.modules.filter((m) => !m.bonus).map(modCard).join('')}</div>
    ${course.modules.some((m) => m.bonus) ? `<h2>Bônus exclusivos</h2><div class="grid">${course.modules.filter((m) => m.bonus).map(modCard).join('')}</div>` : ''}
    <a class="card chatcta" href="#/chat"><span class="ic" aria-hidden="true">💬</span><div><b>Chat 24h com o ${esc(me.assistant)}</b><span class="muted sm">Tire dúvidas sobre receitas, porções e cuidados, a qualquer hora</span></div></a>
  </main>`;
}

function aulas() {
  setTab('aulas');
  view().innerHTML = `<main><h1>Aulas</h1><p class="muted sm">Todos os módulos e bônus do guia.</p>
    <div class="grid" style="margin-top:14px">${course.modules.map(modCard).join('')}</div></main>`;
}

function moduleView(id) {
  const m = course.modules.find((x) => x.id === id);
  if (!m) return (location.hash = '#/');
  setTab(m.bonus ? 'home' : 'aulas', true);
  const d = done();
  view().innerHTML = `<main><span class="kick">${m.bonus ? 'Bônus' : 'Módulo'}</span><h1>${esc(m.title)}</h1><p class="muted sm">${esc(m.description)}</p>
    <div class="lessons">${m.lessons.map((l, i) => `<a class="card les${d.has(l.id) ? ' ok' : ''}" href="#/a/${m.id}/${l.id}"><span class="n">${d.has(l.id) ? '✓' : i + 1}</span><div><b>${esc(l.title)}</b>${l.description ? `<span>${esc(l.description)}</span>` : ''}</div></a>`).join('') || '<p class="muted">Aulas em breve.</p>'}</div></main>`;
}

function lessonView(mid, lid) {
  const m = course.modules.find((x) => x.id === mid), l = m?.lessons.find((x) => x.id === lid);
  if (!l) return (location.hash = '#/');
  setTab(m.bonus ? 'home' : 'aulas', true);
  const all = allLessons(), idx = all.findIndex((x) => x.id === l.id), nxt = all[idx + 1];
  const v = l.video;
  let player = '';
  if (v.kind === 'file') player = `<div class="player"><video src="${esc(v.src)}" controls playsinline preload="metadata"></video></div>`;
  else if (v.kind === 'iframe') player = `<div class="player"><iframe src="${esc(v.src)}" title="${esc(l.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  else if (v.kind === 'embed') player = `<div class="player embed" id="embed"></div>`;
  else if (!l.text) player = `<div class="player none">O vídeo desta aula estará disponível em breve.</div>`;
  const isDone = done().has(l.id);
  view().innerHTML = `${player ? `<div style="padding:18px 18px 0">${player}</div>` : ''}<main>
    <span class="kick">${esc(m.title)}</span><h1>${esc(l.title)}</h1>
    ${l.description ? `<p class="muted">${esc(l.description)}</p>` : ''}
    ${l.text ? `<div class="card rich" style="padding:16px;margin-top:14px">${rich(l.text)}</div>` : ''}
    ${l.materials.length ? `<h2>Materiais</h2><div class="mats">${l.materials.map((x) => `<a class="card mat" href="${esc(x.url)}" target="_blank" rel="noopener" download>${esc(x.label)}</a>`).join('')}</div>` : ''}
    <div class="btns">
      <button class="btn ${isDone ? 'ghost' : 'green'}" id="mark" type="button">${isDone ? '✓ Aula concluída' : 'Marcar como concluída'}</button>
      ${nxt ? `<a class="btn" href="#/a/${nxt.mod.id}/${nxt.id}">Próxima aula →</a>` : ''}
      <a class="btn ghost" href="#/chat">Ficou com dúvida? Pergunte no chat</a>
    </div></main>`;
  if (v.kind === 'embed') {
    // Código de player (Panda, VTurb…) colado pelo produtor no painel.
    const box = $('#embed'); box.innerHTML = v.html;
    for (const old of $$('script', box)) { const s = document.createElement('script'); for (const at of old.attributes) s.setAttribute(at.name, at.value); s.text = old.text; old.replaceWith(s); }
  }
  $('#mark').addEventListener('click', () => { const now = !done().has(l.id); setDone(l.id, now); lessonView(mid, lid); if (now && nxt) setTimeout(() => (location.hash = `#/a/${nxt.mod.id}/${nxt.id}`), 500); });
  scrollTo(0, 0);
}

/* ---------- chat ---------- */
const chatKey = () => 'chat:' + (me?.email || '');
function chatLoad() { try { return JSON.parse(localStorage.getItem(chatKey()) || '[]'); } catch { return []; } }
function chatSave(list) { try { localStorage.setItem(chatKey(), JSON.stringify(list.slice(-40))); } catch {} }
const SUGS = ['Posso dar bifinho todo dia?', 'Quantos petiscos por dia para um cão pequeno?', 'Por quanto tempo os bifinhos duram na geladeira?', 'Meu cachorro comeu chocolate, e agora?'];

function chatView() {
  setTab('chat');
  const list = chatLoad();
  view().innerHTML = `<div class="chat">
    <div class="hd"><span class="av" aria-hidden="true">🩺</span><div><b>${esc(me.assistant)} virtual</b><span>online 24h</span></div></div>
    <div class="disc">Assistente com inteligência artificial treinado para tirar dúvidas do guia. Não substitui a consulta com o veterinário. Em emergência, procure atendimento na hora.</div>
    <div class="msgs" id="msgs" aria-live="polite"></div>
    <div class="sugs" id="sugs"></div>
    <form class="inp" id="chat-form"><textarea name="q" rows="1" placeholder="Escreva sua dúvida…" aria-label="Sua mensagem" maxlength="1500"></textarea><button type="submit" aria-label="Enviar">➤</button></form>
  </div>`;
  const box = $('#msgs'), form = $('#chat-form'), ta = form.q;
  const add = (cls, text) => { const d = document.createElement('div'); d.className = 'bub ' + cls; d.textContent = text; box.append(d); box.scrollTop = box.scrollHeight; return d; };
  if (!list.length) add('vet', `Oi${me.name ? ', ' + me.name.split(' ')[0] : ''}! 🐾 Sou o ${me.assistant} virtual do guia. Pode me perguntar sobre as receitas, porções, ingredientes ou cuidados com o seu cachorro.`);
  for (const m of list) add(m.role === 'user' ? 'me' : 'vet', m.content);
  if (!me.chat) add('err', 'O chat ainda não foi ativado pelo produtor. Volte mais tarde.');
  const sugs = $('#sugs');
  if (!list.length && me.chat) sugs.innerHTML = SUGS.map((s) => `<button type="button">${esc(s)}</button>`).join('');
  sugs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { ta.value = b.textContent; form.requestSubmit(); } });
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer: fine)').matches) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = ta.value.trim();
    if (!q || !me.chat) return;
    sugs.innerHTML = '';
    ta.value = ''; ta.style.height = 'auto';
    const hist = chatLoad(); hist.push({ role: 'user', content: q }); chatSave(hist);
    add('me', q);
    const typing = document.createElement('div'); typing.className = 'typing'; typing.innerHTML = '<i></i><i></i><i></i>'; box.append(typing); box.scrollTop = box.scrollHeight;
    form.querySelector('button').disabled = true;
    try {
      const r = await api('chat', { method: 'POST', body: JSON.stringify({ messages: hist.slice(-12) }) });
      typing.remove(); add('vet', r.reply);
      const h2 = chatLoad(); h2.push({ role: 'assistant', content: r.reply }); chatSave(h2);
    } catch (ex) {
      typing.remove(); if (!ex.login) add('err', ex.message);
      const h2 = chatLoad(); if (h2.length && h2[h2.length - 1].role === 'user') { h2.pop(); chatSave(h2); }
    } finally { form.querySelector('button').disabled = false; ta.focus(); }
  });
}

function conta() {
  setTab('conta');
  const d = done(), all = allLessons();
  view().innerHTML = `<main><h1>Sua conta</h1>
    <div class="card acc"><div><span class="muted">E-mail</span><b>${esc(me.email)}</b></div>${me.name ? `<div><span class="muted">Nome</span><b>${esc(me.name)}</b></div>` : ''}<div><span class="muted">Aulas concluídas</span><b>${all.filter((l) => d.has(l.id)).length} de ${all.length}</b></div></div>
    ${me.support ? `<h2>Suporte</h2><div class="card acc"><div style="display:block">${esc(me.support)}</div></div>` : ''}
    <div class="btns">${canOfferInstall() ? '<button class="btn" type="button" data-install>📲 Instalar o app no celular</button>' : ''}<button class="btn ghost" id="logout" type="button">Sair</button></div></main>`;
  $('#logout').addEventListener('click', async () => {
    await api('logout', { method: 'POST' }).catch(() => {});
    navigator.serviceWorker?.controller?.postMessage('logout'); // apaga os dados guardados para o modo offline
    me = null; setStep('email'); showLogin();
  });
}

function route() {
  if (!course) return;
  const h = location.hash.replace(/^#\/?/, '').split('/');
  if (h[0] === 'm') return moduleView(h[1]);
  if (h[0] === 'a') return lessonView(h[1], h[2]);
  if (h[0] === 'aulas') return aulas();
  if (h[0] === 'chat') return chatView();
  if (h[0] === 'conta') return conta();
  home();
}
addEventListener('hashchange', () => { route(); if (!location.hash.startsWith('#/a/')) scrollTo(0, 0); });

async function boot() {
  try {
    [me, course] = await Promise.all([api('me'), api('course')]);
  } catch (ex) {
    if (ex.login) return;
    document.body.innerHTML = `<div class="login"><div class="card" style="padding:24px;max-width:420px"><h1>Não foi possível abrir</h1><p class="muted">${esc(ex.message)}</p></div></div>`;
    return;
  }
  $('#login').hidden = true; $('#app').hidden = false; $('#nav').hidden = false;
  $('#brand').textContent = course.title || 'Área de membros';
  if (!document.title || document.title === 'Área de membros') document.title = course.title || 'Área de membros';
  route();
}
boot();
