// Painel: área de membros (aulas, alunos, chat do auxiliar e webhook).
//   GET  ?a=course | ?a=settings | ?a=members&q=
//   PUT  ?a=course | ?a=settings
//   POST ?a=members-add | ?a=member | ?a=test-key
import { isAuthed, sameOriginWrite, json } from '../lib/auth.js';
import {
  membersConfigured, NO_DB_MSG, kvGet, kvSet, listMembers, upsertMember, updateMember, deleteMember, normEmail, validEmail,
} from '../lib/members.js';
import { courseDefaults, sanitizeCourse, settingsDefaults, sanitizeSettings, publicSettings } from '../lib/course.js';
import { testKey } from '../lib/vet.js';

const getSettings = async () => sanitizeSettings({}, { ...settingsDefaults(), ...((await kvGet('settings')) || {}) });

async function guard(request, write) {
  if (!isAuthed(request)) return json({ error: 'Faça login.' }, 401);
  if (write && !sameOriginWrite(request)) return json({ error: 'Requisição inválida.' }, 400);
  if (!membersConfigured()) return json({ error: NO_DB_MSG }, 503);
  return null;
}
const fail = (err) => {
  console.error('Área de membros (painel):', err);
  return json({ error: err.expose ? err.message : 'Não foi possível concluir: ' + (err.message || 'erro') }, err.status && err.status < 600 ? err.status : 500);
};

export async function GET(request) {
  const g = await guard(request, false);
  if (g) return g;
  const url = new URL(request.url);
  const a = url.searchParams.get('a');
  try {
    if (a === 'course') return json(sanitizeCourse((await kvGet('course')) || courseDefaults()));
    if (a === 'settings') {
      const s = await getSettings();
      if (!(await kvGet('settings'))) await kvSet('settings', s); // grava o token do webhook na primeira vez
      return json(publicSettings(s));
    }
    if (a === 'members') return json(await listMembers(url.searchParams.get('q') || ''));
    return json({ error: 'Ação inválida.' }, 400);
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(request) {
  const g = await guard(request, true);
  if (g) return g;
  const a = new URL(request.url).searchParams.get('a');
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Dados inválidos.' }, 400); }
  try {
    if (a === 'course') {
      const c = sanitizeCourse(body);
      await kvSet('course', c);
      return json(c);
    }
    if (a === 'settings') {
      const s = sanitizeSettings(body, await getSettings());
      await kvSet('settings', s);
      return json(publicSettings(s));
    }
    return json({ error: 'Ação inválida.' }, 400);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request) {
  const g = await guard(request, true);
  if (g) return g;
  const a = new URL(request.url).searchParams.get('a');
  let body = {};
  try { body = await request.json(); } catch {}
  try {
    if (a === 'members-add') {
      // Uma pessoa por linha: "email" ou "email, nome"
      const lines = String(body.lines || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 2000);
      let added = 0, existing = 0;
      const invalid = [];
      for (const l of lines) {
        const [e, ...rest] = l.split(/[,;\t]/);
        const email = normEmail(e);
        if (!validEmail(email)) { invalid.push(l.slice(0, 80)); continue; }
        const r = await upsertMember({ email, name: rest.join(' ').trim(), source: 'manual', active: true });
        r.created ? added++ : existing++;
      }
      return json({ added, existing, invalid });
    }
    if (a === 'member') {
      const email = normEmail(body.email);
      if (!validEmail(email)) return json({ error: 'E-mail inválido.' }, 400);
      if (body.op === 'activate') await updateMember(email, { active: true });
      else if (body.op === 'deactivate') await updateMember(email, { active: false });
      else if (body.op === 'reset') await updateMember(email, { pass_hash: null });
      else if (body.op === 'delete') await deleteMember(email);
      else return json({ error: 'Operação inválida.' }, 400);
      return json({ ok: true });
    }
    if (a === 'test-key') {
      const s = await getSettings();
      if (!s.ai_key) return json({ error: 'Cole a chave da API e salve antes de testar.' }, 400);
      const reply = await testKey(s);
      return json({ ok: true, reply });
    }
    return json({ error: 'Ação inválida.' }, 400);
  } catch (err) {
    return fail(err);
  }
}
