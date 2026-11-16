// Autoriza o navegador a enviar o arquivo direto ao Vercel Blob
// (sem passar pelo limite de 4,5 MB das funções).
//
// - Projeto conectado ao Blob por OIDC (padrão atual: só BLOB_STORE_ID):
//   fluxo "presigned" — o servidor emite um token assinado com escopo no arquivo.
// - Projeto com BLOB_READ_WRITE_TOKEN: fluxo clássico de client token.
import { handleUpload, handleUploadPresigned } from '@vercel/blob/client';
import { issueSignedToken } from '@vercel/blob';
import { isAuthed, sameOriginWrite, json } from '../lib/auth.js';
import { blobConfigured, NO_BLOB_MSG, uploadMode } from '../lib/store.js';

const KINDS = {
  image: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], max: 8 * 1024 * 1024 },
  video: { types: ['video/mp4', 'video/webm'], max: 1024 * 1024 * 1024 },
  // Imagem ou vídeo curto que cobre o player quando a pessoa pausa.
  pause: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'], max: 100 * 1024 * 1024 },
};

function rules(pathname, clientPayload) {
  const kind = KINDS[clientPayload];
  if (!kind || !/^vsl\/uploads\/[a-z0-9._-]{1,120}$/i.test(pathname)) {
    throw new Error('Envio não permitido.');
  }
  return kind;
}

export async function POST(request) {
  if (!isAuthed(request)) return json({ error: 'Sessão expirada. Entre de novo.' }, 401);
  if (!sameOriginWrite(request)) return json({ error: 'Requisição inválida.' }, 400);
  if (!blobConfigured()) return json({ error: NO_BLOB_MSG }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Dados inválidos.' }, 400);
  }
  try {
    if (uploadMode() === 'presigned') {
      const result = await handleUploadPresigned({
        request,
        body,
        getSignedToken: async (pathname, clientPayload) => {
          const kind = rules(pathname, clientPayload);
          const token = await issueSignedToken({
            pathname,
            operations: ['put'],
            validUntil: Date.now() + 30 * 60 * 1000,
            allowedContentTypes: kind.types,
            maximumSizeInBytes: kind.max,
          });
          return {
            token,
            urlOptions: {
              allowedContentTypes: kind.types,
              maximumSizeInBytes: kind.max,
              addRandomSuffix: true,
              cacheControlMaxAge: 31536000,
            },
          };
        },
      });
      return json(result);
    }
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const kind = rules(pathname, clientPayload);
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
    console.error('Falha ao autorizar envio:', err);
    return json({ error: err?.message || 'Falha no envio.' }, 400);
  }
}
