// Gera o token para o navegador enviar o arquivo direto ao Vercel Blob
// (sem passar pelo limite de 4,5 MB das funções).
import { handleUpload } from '@vercel/blob/client';
import { isAuthed, sameOriginWrite, json } from '../lib/auth.js';

const KINDS = {
  image: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], max: 8 * 1024 * 1024 },
  video: { types: ['video/mp4', 'video/webm'], max: 1024 * 1024 * 1024 },
};

export async function POST(request) {
  if (!isAuthed(request)) return json({ error: 'Sessão expirada. Entre de novo.' }, 401);
  if (!sameOriginWrite(request)) return json({ error: 'Requisição inválida.' }, 400);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Dados inválidos.' }, 400);
  }
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const kind = KINDS[clientPayload];
        if (!kind || !/^vsl\/uploads\/[a-z0-9._-]{1,120}$/i.test(pathname)) {
          throw new Error('Envio não permitido.');
        }
        return {
          allowedContentTypes: kind.types,
          maximumSizeInBytes: kind.max,
          addRandomSuffix: true,
          cacheControlMaxAge: 31536000,
        };
      },
    });
    return json(result);
  } catch (err) {
    return json({ error: err?.message || 'Falha no envio.' }, 400);
  }
}
