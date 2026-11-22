// Aba "Métricas" do painel: números principais, curva de retenção, visualizações
// por dia e tabelas por dispositivo e origem.

const $ = (s, r = document) => r.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';

let loaded = false;
let last = null;

/* ---------- abas ---------- */

function showTab(name) {
  for (const b of document.querySelectorAll('.tab')) {
    if (b.dataset.tab === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  $('#tab-edit').hidden = name !== 'edit';
  $('#tab-metrics').hidden = name !== 'metrics';
  $('#tab-sales').hidden = name !== 'sales';
  $('#tab-area').hidden = name !== 'area';
  if (name === 'metrics' && !loaded) load();
}
for (const b of document.querySelectorAll('.tab')) b.addEventListener('click', () => showTab(b.dataset.tab));

/* ---------- formatação ---------- */

const nf = new Intl.NumberFormat('pt-BR');
const num = (n) => nf.format(n || 0);
const pct = (a, b) => (b ? (a / b) * 100 : 0);
const fmtPct = (v) => (v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1).replace('.', ',')) + '%';
function mmss(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}
const dayLabel = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);

function el(tag, attrs = {}, text) {
  const n = tag === 'svg' || ['line', 'path', 'rect', 'text', 'circle', 'g'].includes(tag)
    ? document.createElementNS(NS, tag)
    : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}

function msg(type, text) {
  const box = $('#m-msg');
  box.replaceChildren();
  if (!text) return;
  const d = el('div', { class: 'flash ' + type, role: type === 'err' ? 'alert' : 'status' }, text);
  box.append(d);
}

/* ---------- carregamento ---------- */

async function load() {
  loaded = true;
  const range = (document.querySelector('input[name=m_range]:checked') || {}).value || '7d';
  const page = (document.querySelector('input[name=m_page]:checked') || {}).value || 'vsl';
  const btn = $('#m-refresh');
  btn.disabled = true;
  btn.textContent = 'Carregando…';
  try {
    const res = await fetch('/api/metrics?range=' + range + '&page=' + page, { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ' + res.status);
    if (data.configured === false) {
      $('#m-body').hidden = true;
      msg('err', data.error);
      return;
    }
    msg('', '');
    last = data;
    $('#m-body').hidden = false;
    render(data);
  } catch (ex) {
    msg('err', 'Não foi possível carregar as métricas: ' + ex.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Atualizar';
  }
}

$('#m-refresh').addEventListener('click', load);
for (const r of document.querySelectorAll('input[name=m_range], input[name=m_page]')) r.addEventListener('change', load);

$('#m-reset').addEventListener('click', async () => {
  if (!confirm('Zerar as métricas? A contagem começa do zero a partir de agora.')) return;
  try {
    const res = await fetch('/api/metrics', { method: 'POST', credentials: 'same-origin', headers: { 'x-vsl': '1' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro ' + res.status);
    await load();
    msg('ok', 'Métricas zeradas. A página pública passa a contar do zero em até 1 minuto.');
  } catch (ex) {
    msg('err', 'Não foi possível zerar: ' + ex.message);
  }
});

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => last && !$('#tab-metrics').hidden && render(last), 150);
});

/* ---------- desenho ---------- */

function render(d) {
  renderKpis(d);
  renderRetention(d);
  renderDaily(d);
  renderTable($('#dev-table'), ['Dispositivo', 'Visitas', 'Plays', 'Play rate', 'Cliques'],
    d.devices.map((r) => [r.name === 'm' ? 'Celular' : 'Computador', num(r.views), num(r.plays), fmtPct(pct(r.plays, r.views)), num(r.cta)]));
  renderTable($('#src-table'), ['Origem', 'Visitas', 'Plays', 'Cliques', 'Conversão'],
    d.sources.map((r) => [r.name, num(r.views), num(r.plays), num(r.cta), fmtPct(pct(r.cta, r.views))]));
}

function renderKpis(d) {
  const hasPitch = d.pitchSec > 0;
  const tiles = [
    ['Visualizações da página', num(d.views), `${num(d.uniques)} visitantes únicos`],
    ['Play rate', fmtPct(pct(d.plays, d.views)), `${num(d.plays)} deram play`],
    ['Engajamento médio', fmtPct(d.avgWatch * 100), d.duration ? `do vídeo de ${mmss(d.duration)}` : 'do vídeo assistido'],
    d.page === 'oferta'
      ? ['Chegaram na oferta', fmtPct(pct(d.pitch, d.views)), `${num(d.pitch)} pessoas rolaram até a ficha da oferta`]
      : ['Chegaram no pitch', hasPitch ? fmtPct(pct(d.pitch, d.plays)) : '—',
        hasPitch ? `${num(d.pitch)} pessoas · pitch em ${mmss(d.pitchSec)}` : 'Defina o momento do pitch na aba VSL'],
    ['Assistiram até o final', fmtPct(pct(d.finish, d.plays)), `${num(d.finish)} pessoas`],
    ['Cliques no botão', num(d.cta), `${fmtPct(pct(d.cta, d.views))} das visualizações`],
  ];
  $('#kpis').replaceChildren(...tiles.map(([label, value, sub]) => {
    const k = el('div', { class: 'kpi' });
    k.append(el('div', { class: 'k-label' }, label), el('div', { class: 'k-value' }, value), el('div', { class: 'k-sub' }, sub));
    return k;
  }));
}

function renderTable(table, head, rows) {
  table.replaceChildren();
  const thead = el('thead');
  const tr = el('tr');
  head.forEach((h) => tr.append(el('th', { scope: 'col' }, h)));
  thead.append(tr);
  const tbody = el('tbody');
  if (!rows.length) {
    const r = el('tr');
    r.append(el('td', { colspan: head.length }, 'Sem dados no período.'));
    tbody.append(r);
  }
  for (const row of rows) {
    const r = el('tr');
    row.forEach((c) => r.append(el('td', {}, c)));
    tbody.append(r);
  }
  table.append(thead, tbody);
}

function tooltip(box, html, x, y) {
  let tip = box.querySelector('.tip');
  if (!tip) {
    tip = el('div', { class: 'tip', role: 'status' });
    box.append(tip);
  }
  tip.replaceChildren(...html);
  tip.hidden = false;
  const w = tip.offsetWidth, bw = box.clientWidth;
  tip.style.left = Math.max(0, Math.min(bw - w, x + 12 > bw - w ? x - w - 12 : x + 12)) + 'px';
  tip.style.top = Math.max(0, y - 10) + 'px';
}
const hideTip = (box) => { const t = box.querySelector('.tip'); if (t) t.hidden = true; };

function niceTicks(max, count) {
  const steps = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
  const step = steps.find((s) => max / s <= count) || 3600;
  const out = [];
  for (let t = 0; t <= max; t += step) out.push(t);
  return out;
}

function renderRetention(d) {
  const box = $('#ret-chart');
  box.replaceChildren();
  const pts = d.retention;
  if (!d.plays || pts.length < 2) {
    box.append(el('div', { class: 'empty' }, d.views ? 'Ninguém deu play no período ainda.' : 'Sem visitas no período.'));
    renderTable($('#ret-table'), ['Momento', 'Ainda assistindo', 'Pessoas'], []);
    return;
  }
  const W = Math.max(300, box.clientWidth), H = 260;
  const m = { l: 44, r: 16, t: 22, b: 28 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const maxT = pts[pts.length - 1].t;
  const x = (t) => m.l + (maxT ? (t / maxT) * iw : 0);
  const y = (v) => m.t + ih - (v / 100) * ih;
  const val = (p) => pct(p.n, d.plays);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, tabindex: 0, role: 'img',
    'aria-label': `Curva de retenção: ${fmtPct(val(pts[Math.min(pts.length - 1, Math.round(pts.length / 2))]))} ainda assistindo na metade do vídeo. Use as setas para percorrer.` });
  for (const v of [0, 25, 50, 75, 100]) {
    svg.append(el('line', { class: v ? 'grid' : 'base', x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
    svg.append(el('text', { class: 'axis', x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, v + '%'));
  }
  for (const t of niceTicks(maxT, 6)) {
    svg.append(el('text', { class: 'axis', x: x(t), y: H - 8, 'text-anchor': 'middle' }, mmss(t)));
  }
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(val(p)).toFixed(1)}`).join('');
  svg.append(el('path', { class: 'area', d: `${line}L${x(maxT)},${y(0)}L${x(0)},${y(0)}Z` }));
  svg.append(el('path', { class: 'line', d: line }));

  // Marcação do pitch, com o valor naquele ponto como rótulo direto.
  if (d.pitchSec > 0 && d.pitchSec <= maxT) {
    const p = pts.reduce((a, b) => (Math.abs(b.t - d.pitchSec) < Math.abs(a.t - d.pitchSec) ? b : a));
    const px = x(d.pitchSec);
    svg.append(el('line', { class: 'pitch', x1: px, x2: px, y1: m.t - 6, y2: m.t + ih }));
    const anchor = px > W - 140 ? 'end' : 'start';
    svg.append(el('text', { class: 'pitch-label', x: px + (anchor === 'end' ? -6 : 6), y: m.t - 8, 'text-anchor': anchor },
      `Pitch ${mmss(d.pitchSec)} · ${fmtPct(val(p))}`));
  }

  const xh = el('line', { class: 'xhair', y1: m.t, y2: m.t + ih, visibility: 'hidden' });
  const dot = el('circle', { class: 'dot', r: 5, visibility: 'hidden' });
  svg.append(xh, dot);
  const hit = el('rect', { x: m.l, y: 0, width: iw, height: H, fill: 'transparent' });
  svg.append(hit);
  box.append(svg);

  let idx = -1;
  const showAt = (i) => {
    idx = Math.max(0, Math.min(pts.length - 1, i));
    const p = pts[idx];
    const px = x(p.t), py = y(val(p));
    xh.setAttribute('x1', px); xh.setAttribute('x2', px); xh.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('visibility', 'visible');
    const scale = box.clientWidth / W;
    const strong = el('strong', {}, fmtPct(val(p)) + ' ainda assistindo');
    const key = el('div', {});
    key.append(el('span', { class: 'tk' }), document.createTextNode(`${num(p.n)} de ${num(d.plays)} pessoas`));
    tooltip(box, [strong, key, el('div', {}, 'em ' + mmss(p.t))], px * scale, py * scale);
  };
  const hide = () => { xh.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip(box); };
  svg.addEventListener('pointermove', (ev) => {
    const r = svg.getBoundingClientRect();
    const t = ((ev.clientX - r.left) * (W / r.width) - m.l) / iw * maxT;
    showAt(Math.round(t / (pts[1].t - pts[0].t)));
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (ev) => {
    const step = ev.shiftKey ? 12 : 1;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); showAt((idx < 0 ? 0 : idx) + step); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); showAt((idx < 0 ? 0 : idx) - step); }
    else if (ev.key === 'Escape') hide();
  });

  // Tabela: a cada 30 s (ou a cada ponto, em vídeos curtos).
  const every = maxT > 300 ? 30 : 5;
  renderTable($('#ret-table'), ['Momento', 'Ainda assistindo', 'Pessoas'],
    pts.filter((p) => p.t % every === 0).map((p) => [mmss(p.t), fmtPct(val(p)), num(p.n)]));
}

function renderDaily(d) {
  const box = $('#daily-chart');
  box.replaceChildren();
  const days = d.daily;
  renderTable($('#daily-table'), ['Dia', 'Visitas', 'Plays', 'Cliques'], days.map((r) => [dayLabel(r.day), num(r.views), num(r.plays), num(r.cta)]));
  const max = Math.max(...days.map((r) => r.views));
  if (!max) {
    box.append(el('div', { class: 'empty' }, 'Sem visitas no período.'));
    return;
  }
  const W = Math.max(300, box.clientWidth), H = 220;
  const m = { l: 44, r: 8, t: 12, b: 28 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const top = niceMax(max);
  const y = (v) => m.t + ih - (v / top) * ih;
  const slot = iw / days.length;
  const bw = Math.max(2, Math.min(36, slot - 2)); // 2px de respiro entre barras
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': `Visualizações por dia, máximo de ${num(max)}.` });
  for (const v of [0, top / 2, top]) {
    svg.append(el('line', { class: v ? 'grid' : 'base', x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
    svg.append(el('text', { class: 'axis', x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, num(v)));
  }
  const labelEvery = Math.ceil(days.length / Math.max(1, Math.floor(iw / 48)));
  days.forEach((r, i) => {
    const cx = m.l + slot * i + slot / 2;
    const h = Math.max(r.views ? 2 : 0, ih - (y(r.views) - m.t));
    const top4 = Math.min(4, h / 2, bw / 2);
    const x0 = cx - bw / 2, y0 = m.t + ih - h;
    // Barra com cantos de 4px só no topo, presa na base.
    const path = h
      ? `M${x0},${m.t + ih}V${y0 + top4}Q${x0},${y0} ${x0 + top4},${y0}H${x0 + bw - top4}Q${x0 + bw},${y0} ${x0 + bw},${y0 + top4}V${m.t + ih}Z`
      : '';
    const bar = el('path', { class: 'bar', d: path, tabindex: 0, 'aria-label': `${dayLabel(r.day)}: ${num(r.views)} visitas, ${num(r.plays)} plays, ${num(r.cta)} cliques` });
    const hitbox = el('rect', { x: m.l + slot * i, y: m.t, width: slot, height: ih, fill: 'transparent' });
    const show = () => {
      bar.classList.add('hover');
      const scale = box.clientWidth / W;
      const key = (t) => { const dv = el('div'); dv.append(el('span', { class: 'tk' }), document.createTextNode(t)); return dv; };
      tooltip(box, [el('strong', {}, `${num(r.views)} visitas`), key(`${num(r.plays)} plays`), key(`${num(r.cta)} cliques`), el('div', {}, dayLabel(r.day))], cx * scale, y0 * scale);
    };
    const hide = () => { bar.classList.remove('hover'); hideTip(box); };
    for (const t of [bar, hitbox]) {
      t.addEventListener('pointerenter', show);
      t.addEventListener('pointerleave', hide);
    }
    bar.addEventListener('focus', show);
    bar.addEventListener('blur', hide);
    svg.append(bar, hitbox);
    if (i % labelEvery === 0) svg.append(el('text', { class: 'axis', x: cx, y: H - 8, 'text-anchor': 'middle' }, dayLabel(r.day)));
  });
  box.append(svg);
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p;
  return 10 * p;
}
