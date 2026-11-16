// Servidor local para testar sem a Vercel: npm run dev
// Usa a pasta .dev-data/ no lugar do Vercel Blob.
import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = Number(process.env.PORT) || 3000;
process.env.VSL_LOCAL_DIR ??= path.join(ROOT, '.dev-data');
process.env.ADMIN_PASSWORD ??= 'teste123';
process.env.SESSION_SECRET ??= 'dev-secret';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm' };
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let p = url.pathname;
  if (p === '/') p = '/api/page';
  if (p === '/admin') p = '/admin.html';
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);

  try {
    if (p === '/api/dev-upload') {
      const ext = EXT[req.headers['content-type']];
      if (!ext) return send(res, 400, { error: 'Formato não aceito.' });
      const name = randomBytes(8).toString('hex') + '.' + ext;
      await mkdir(path.join(process.env.VSL_LOCAL_DIR, 'uploads'), { recursive: true });
      await writeFile(path.join(process.env.VSL_LOCAL_DIR, 'uploads', name), body);
      return send(res, 200, { url: `http://127.0.0.1:${PORT}/dev-uploads/${name}` });
    }
    if (p.startsWith('/api/')) {
      const mod = await import(path.join(ROOT, p + '.js'));
      const fn = mod[req.method];
      if (!fn) return send(res, 405, { error: 'Método não permitido' });
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const r = await fn(request);
      res.writeHead(r.status, Object.fromEntries(r.headers));
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    const file = p.startsWith('/dev-uploads/')
      ? path.join(process.env.VSL_LOCAL_DIR, 'uploads', path.basename(p))
      : path.join(ROOT, 'public', path.normalize(p));
    if (!file.startsWith(ROOT)) return send(res, 404, {});
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ERR_MODULE_NOT_FOUND') return send(res, 404, { error: 'Não encontrado' });
    console.error(err);
    send(res, 500, { error: err.message });
  }
}).listen(PORT, () => console.log(`VSL local: http://127.0.0.1:${PORT}  painel: /admin  (senha: ${process.env.ADMIN_PASSWORD})`));

function send(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}
