# VSL

Página de vídeo de vendas com fundo preto — logo, selo, título, vídeo,
botão de compra com atraso opcional e depoimentos de clientes — e um painel
em `/admin` para editar tudo sem mexer no código.

Feita para a **Vercel**: funções Node em `api/` e arquivos/conteúdo no
**Vercel Blob**.

```
api/page.js        página pública (renderizada no servidor, cache de 30 s no CDN)
api/content.js     ler/salvar o conteúdo (exige login)
api/upload.js      autoriza o envio direto do navegador para o Blob
api/login.js       login / api/logout.js / api/session.js
lib/               validação, armazenamento, sessão e HTML da página
public/admin.*     painel
public/vendor/     cliente do Vercel Blob para o navegador (npm run bundle)
dev/server.mjs     servidor local para testes (npm run dev)
```

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | O que é |
|---|---|
| `ADMIN_PASSWORD` | senha do painel |
| `SESSION_SECRET` | texto aleatório longo usado para assinar a sessão |
| `BLOB_READ_WRITE_TOKEN` | criada automaticamente ao conectar um Blob store ao projeto |

Trocar `ADMIN_PASSWORD` ou `SESSION_SECRET` desconecta todas as sessões.
Depois de mudar uma variável, faça um **Redeploy** para ela valer.

## O que o painel edita

- **Marca**: nome e logo.
- **Topo**: selo, título e linha de apoio.
- **Vídeo**: link (YouTube, Vimeo, `.mp4` direto ou link de player), envio de
  arquivo MP4/WEBM de até 1 GB, ou o código de embed do VTurb/Panda. Formato
  9:16, 4:5, 1:1 ou 16:9.
- **Botão de compra**: texto, link do checkout, cor e atraso em segundos. Com
  vídeo próprio o atraso conta o tempo assistido; com YouTube/players externos
  conta o tempo de página aberta. Quem já viu o botão volta a vê-lo direto.
- **Depoimentos**: nome, cidade, estrelas, texto, foto do cliente e imagem
  extra; adicionar, excluir e reordenar.
- **Rodapé** e **código no `<head>`** (Meta Pixel, UTMify, Google Tag).

Alterações aparecem na página pública em até ~1 minuto (cache do CDN). O botão
"Ver página" do painel abre uma versão sem cache logo depois de salvar.

## Segurança

- Sessão em cookie `HttpOnly`, `Secure`, `SameSite=Strict`, assinado com HMAC;
  toda escrita exige também o header `X-VSL` (proteção contra CSRF).
- Uploads vão do navegador direto para o Blob com um token emitido só para
  quem está logado, limitado por tipo (JPG/PNG/WEBP/GIF, MP4/WEBM) e tamanho.
  SVG não é aceito.
- Todo conteúdo salvo passa por validação no servidor; links só `http(s)://`;
  mídia só do próprio Blob. Arquivos trocados ou removidos são apagados do Blob.
- O código de embed e o do `<head>` são impressos como estão: só quem tem a
  senha do painel consegue alterá-los.

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://127.0.0.1:3000` (painel em `/admin`, senha `teste123`) usando a
pasta `.dev-data/` no lugar do Blob.
