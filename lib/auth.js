// Login do painel: senha em ADMIN_PASSWORD, sessão em cookie assinado (HMAC).
// Trocar a senha ou o SESSION_SECRET derruba todas as sessões abertas.

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE = 'vsl_s';
const TTL = 8 * 3600; // segundos

export function configured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET);
}

const sha = (s) => createHash('sha256').update(String(s)).digest();

export function passwordOk(input) {
  if (!configured()) return false;
  return timingSafeEqual(sha(input), sha(process.env.ADMIN_PASSWORD));
}

function sign(exp) {
  return createHmac('sha256', process.env.SESSION_SECRET)
    .update(`vsl:${exp}:`)
    .update(sha(process.env.ADMIN_PASSWORD))
    .digest('base64url');
}

const secureFlag = () => (process.env.VSL_LOCAL_DIR ? '' : '; Secure');

export function sessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL}${secureFlag()}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureFlag()}`;
}

export function isAuthed(request) {
  if (!configured()) return false;
  const raw = request.headers.get('cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([A-Za-z0-9_-]+)`));
  if (!m) return false;
  const exp = Number(m[1]);
  if (!exp || exp < Date.now() / 1000) return false;
  const a = Buffer.from(m[2]);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Proteção contra CSRF: além do SameSite=Strict, toda escrita exige o header
 * X-VSL, que um formulário de outro site não consegue enviar.
 */
export function sameOriginWrite(request) {
  return request.headers.get('x-vsl') === '1';
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
