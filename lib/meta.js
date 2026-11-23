// API de Conversões do Meta: envia eventos direto do servidor para o pixel.
// Funciona mesmo com bloqueador de anúncio / Safari, e marca a compra
// aprovada que chega pelo webhook da plataforma de vendas.
import { createHash } from 'node:crypto';
import { pixelIds } from './content.js';

const GRAPH = 'https://graph.facebook.com/v23.0';
const sha = (s) => createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex');

/** Pixels que têm token configurado: [[pixelId, token], ...] */
export function capiTargets(settings, content) {
  const tokens = settings?.meta_tokens || {};
  const ids = pixelIds(`${content?.meta_pixel_id || ''},${process.env.META_PIXEL_ID || ''}`);
  return ids.filter((id) => tokens[id]).map((id) => [id, tokens[id]]);
}

/** Dados do comprador já no formato do Meta (com hash). */
export function userData({ email, phone, name, ip, ua, fbp, fbc, externalId } = {}) {
  const u = {};
  if (email) u.em = [sha(email)];
  if (phone) {
    let d = String(phone).replace(/\D/g, '');
    if (d.length >= 10 && d.length <= 11) d = '55' + d; // celular brasileiro sem o 55
    if (d.length >= 12) u.ph = [sha(d)];
  }
  if (name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts[0]) u.fn = [sha(parts[0])];
    if (parts.length > 1) u.ln = [sha(parts[parts.length - 1])];
  }
  if (externalId || email) u.external_id = [sha(externalId || email)];
  if (ip) u.client_ip_address = ip;
  if (ua) u.client_user_agent = ua;
  if (fbp) u.fbp = fbp;
  if (fbc) u.fbc = fbc;
  u.country = [sha('br')];
  return u;
}

/** Envia um evento para todos os pixels com token. Erros só vão para o log. */
export async function sendCapi(settings, content, event) {
  const targets = capiTargets(settings, content);
  if (!targets.length) return { sent: 0 };
  const data = [{ action_source: 'website', event_time: Math.floor(Date.now() / 1000), ...event }];
  const body = { data };
  if (settings.meta_test_code) body.test_event_code = settings.meta_test_code;
  let sent = 0;
  await Promise.all(targets.map(async ([id, token]) => {
    try {
      const res = await fetch(`${GRAPH}/${id}/events?access_token=${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) console.error(`Meta CAPI (${id}) recusou ${event.event_name}:`, res.status, out?.error?.message || '');
      else { sent++; console.log(`Meta CAPI (${id}): ${event.event_name} enviado`, out?.events_received ?? ''); }
    } catch (err) {
      console.error(`Meta CAPI (${id}) falhou:`, err?.message);
    }
  }));
  return { sent };
}

/** Procura o valor da venda e o código do pedido no aviso da plataforma. */
export function saleDetails(payload) {
  let value = 0, order = '', phone = '', ddd = '';
  const walk = (o, path = []) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      const key = k.toLowerCase(), p = [...path, key].join('.');
      if (v && typeof v === 'object') { walk(v, [...path, key]); continue; }
      const s = String(v ?? '').trim();
      if (!s) continue;
      if (!value && /(sale_amount|^amount$|^value$|^price$|full_price|total|valor|charge_amount|commission_value)/.test(key) && !/(producer|affiliate|fee|tax|comiss)/.test(p)) {
        let n = Number(s.replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
        if (/cents|centavos/.test(key) || (Number.isInteger(n) && n >= 1000 && /amount/.test(key) && !s.includes('.') && !s.includes(','))) n = n / 100;
        if (n > 0 && n < 100000) value = Math.round(n * 100) / 100;
      }
      if (!order && /(^code$|order_?id|order_?code|transaction|transacao|sale_?code|purchase_?code|^id$)/.test(key)) order = s.slice(0, 80);
      if (!ddd && /(area_?code|ddd)/.test(key) && /^\d{2}$/.test(s.replace(/\D/g, ''))) ddd = s.replace(/\D/g, '');
      if (!phone && /(phone|telefone|celular|whatsapp)/.test(key) && !/(area_?code|ddd)/.test(key) && /\d{8,}/.test(s.replace(/\D/g, ''))) phone = s;
    }
  };
  walk(payload);
  const digits = phone.replace(/\D/g, '');
  if (ddd && digits.length >= 8 && digits.length <= 9) phone = ddd + digits; // Perfect Pay manda o DDD separado
  return { value, order, phone };
}
