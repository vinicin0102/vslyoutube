// Leitura e gravação do conteúdo no Vercel Blob.
// Em desenvolvimento (VSL_LOCAL_DIR definido) usa uma pasta local.

import { put, get, del } from '@vercel/blob';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { sanitize, isOwnMedia } from './content.js';

const CONTENT_PATH = 'vsl/content.json';
const local = () => process.env.VSL_LOCAL_DIR;
export const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
/** OIDC (só BLOB_STORE_ID) usa envio presigned; token clássico usa client token. */
export const uploadMode = () => (process.env.BLOB_READ_WRITE_TOKEN ? 'token' : 'presigned');
export const NO_BLOB_MSG = 'Armazenamento não conectado: na Vercel, abra Storage → Create → Blob, conecte ao projeto e faça Redeploy.';

export async function loadContent() {
  if (local()) {
    try {
      return sanitize(JSON.parse(await readFile(path.join(local(), 'content.json'), 'utf8')));
    } catch {
      return sanitize({});
    }
  }
  if (!blobConfigured()) return sanitize({});
  let r;
  try {
    r = await get(CONTENT_PATH, { access: 'public' });
  } catch (err) {
    if (err?.name === 'BlobNotFoundError') return sanitize({}); // ainda não salvo
    throw err;
  }
  if (!r || r.statusCode !== 200 || !r.stream) return sanitize({});
  const text = await new Response(r.stream).text();
  try {
    return sanitize(JSON.parse(text));
  } catch {
    return sanitize({});
  }
}

export async function saveContent(data) {
  const json = JSON.stringify(data);
  if (local()) {
    await mkdir(local(), { recursive: true });
    await writeFile(path.join(local(), 'content.json'), json);
    return;
  }
  if (!blobConfigured()) throw Object.assign(new Error(NO_BLOB_MSG), { expose: true });
  await put(CONTENT_PATH, json, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    // O CDN do Blob guarda o arquivo por até 60 s depois de uma alteração.
    cacheControlMaxAge: 60,
  });
}

/** Apaga arquivos enviados que deixaram de ser usados. Falhas não bloqueiam o salvamento. */
export async function deleteMedia(urls) {
  const own = urls.filter(isOwnMedia);
  if (!own.length || local()) return;
  try {
    await del(own);
  } catch (err) {
    console.error('Falha ao apagar mídia antiga:', err?.message);
  }
}
