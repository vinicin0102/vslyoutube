// Diagnóstico temporário do armazenamento. Exige ?t=DIAG_TOKEN.
import { put, del, get } from '@vercel/blob';
import { uploadPresigned } from '@vercel/blob/client';
import { createHash, timingSafeEqual } from 'node:crypto';
import { sessionCookie, json } from '../lib/auth.js';
import { uploadMode } from '../lib/store.js';

const sha = (s) => createHash('sha256').update(String(s)).digest();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

export async function GET(request) {
  const url = new URL(request.url);
  const want = process.env.DIAG_TOKEN;
  if (!want || !timingSafeEqual(sha(url.searchParams.get('t') || ''), sha(want))) return json({ error: 'not found' }, 404);
  const out = { mode: uploadMode(), hasStoreId: Boolean(process.env.BLOB_STORE_ID), hasRW: Boolean(process.env.BLOB_READ_WRITE_TOKEN) };
  const cleanup = [];
  for (const access of ['public', 'private']) {
    try {
      const b = await put('vsl/_diag.txt', 'ok ' + Date.now(), { access, allowOverwrite: true, addRandomSuffix: false });
      out['put_' + access] = 'ok ' + new URL(b.url).hostname;
      cleanup.push(b.url);
      const r = await get('vsl/_diag.txt', { access });
      out['get_' + access] = r ? r.statusCode : 'null';
      break;
    } catch (e) {
      out['put_' + access] = 'ERR ' + (e?.name || '') + ': ' + e?.message;
    }
  }
  try {
    const cookie = sessionCookie().split(';')[0];
    const b = await uploadPresigned('vsl/uploads/diag.png', PNG, {
      access: 'public',
      handleUploadUrl: `${url.origin}/api/upload`,
      clientPayload: 'image',
      contentType: 'image/png',
      headers: { 'x-vsl': '1', cookie },
    });
    out.upload = 'ok ' + b.url;
    cleanup.push(b.url);
  } catch (e) {
    out.upload = 'ERR ' + (e?.name || '') + ': ' + e?.message;
  }
  try {
    if (cleanup.length) await del(cleanup);
    out.cleanup = 'ok';
  } catch (e) {
    out.cleanup = 'ERR ' + e?.message;
  }
  return json(out);
}
