import { configured, passwordOk, sessionCookie, sameOriginWrite, json } from '../lib/auth.js';

export async function POST(request) {
  if (!sameOriginWrite(request)) return json({ error: 'Requisição inválida.' }, 400);
  if (!configured()) return json({ error: 'Defina ADMIN_PASSWORD e SESSION_SECRET na Vercel.' }, 503);
  let body = {};
  try {
    body = await request.json();
  } catch {}
  if (!passwordOk(body?.password ?? '')) {
    await new Promise((r) => setTimeout(r, 600)); // atrasa tentativas em série
    return json({ error: 'Senha incorreta.' }, 401);
  }
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie() });
}
