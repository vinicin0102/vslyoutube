// Diagnóstico temporário: duração do vídeo publicado (lê o cabeçalho do MP4). Exige ?t=DIAG_TOKEN.
import { createHash, timingSafeEqual } from 'node:crypto';
import { loadContent } from '../lib/store.js';
import { json } from '../lib/auth.js';

const sha = (s) => createHash('sha256').update(String(s)).digest();

async function range(url, start, len) {
  const r = await fetch(url, { headers: { range: `bytes=${start}-${start + len - 1}` } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}

async function mp4Duration(url) {
  const head = await fetch(url, { method: 'HEAD' });
  const size = Number(head.headers.get('content-length'));
  let off = 0;
  for (let i = 0; i < 50 && off < size; i++) {
    const h = await range(url, off, 16);
    let boxSize = h.readUInt32BE(0);
    const type = h.toString('ascii', 4, 8);
    let hdr = 8;
    if (boxSize === 1) { boxSize = Number(h.readBigUInt64BE(8)); hdr = 16; }
    if (boxSize === 0) boxSize = size - off;
    if (type === 'moov') {
      const moov = await range(url, off, Math.min(boxSize, 8 * 1024 * 1024));
      const i2 = moov.indexOf('mvhd');
      const ver = moov[i2 + 4];
      const ts = ver === 1 ? moov.readUInt32BE(i2 + 24) : moov.readUInt32BE(i2 + 16);
      const dur = ver === 1 ? Number(moov.readBigUInt64BE(i2 + 28)) : moov.readUInt32BE(i2 + 20);
      return { size, seconds: dur / ts, moovAt: off, faststart: off < size / 2 };
    }
    off += boxSize;
  }
  throw new Error('moov não encontrado');
}

export async function GET(request) {
  const url = new URL(request.url);
  const want = process.env.DIAG_TOKEN;
  if (!want || !timingSafeEqual(sha(url.searchParams.get('t') || ''), sha(want))) return json({ error: 'not found' }, 404);
  const c = await loadContent();
  const v = c.video.type === 'upload' ? c.video.file : c.video.url;
  try {
    return json({ type: c.video.type, pitch: c.cta.delay, video: v, ...(await mp4Duration(v)) });
  } catch (e) {
    return json({ type: c.video.type, pitch: c.cta.delay, video: v, error: e.message });
  }
}
