import { clearCookie, sameOriginWrite, json } from '../lib/auth.js';

export function POST(request) {
  if (!sameOriginWrite(request)) return json({ error: 'Requisição inválida.' }, 400);
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
