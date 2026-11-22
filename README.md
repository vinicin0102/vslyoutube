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
| `BLOB_STORE_ID` / `BLOB_READ_WRITE_TOKEN` | criadas automaticamente ao conectar um Blob store ao projeto |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | criadas ao conectar um banco **Upstash Redis** (métricas) |

Trocar `ADMIN_PASSWORD` ou `SESSION_SECRET` desconecta todas as sessões.
Depois de mudar uma variável, faça um **Redeploy** para ela valer.

## O que o painel edita

- **Marca**: nome e logo.
- **Topo**: selo, título e linha de apoio.
- **Vídeo**: link (YouTube, Vimeo, `.mp4` direto ou link de player), envio de
  arquivo MP4/WEBM de até 1 GB, ou o código de embed do VTurb/Panda. Formato
  9:16, 4:5, 1:1 ou 16:9.
- **Imagem ao pausar**: cobre o vídeo sempre que a pessoa pausa; clicar nela
  volta a tocar. Funciona com arquivo enviado, link `.mp4`, YouTube e Vimeo
  (não com código de player, que não avisa quando pausa).
- **Oferta e momento do pitch**: o botão (com texto opcional acima, como preço
  ou bônus) aparece quando o vídeo chega no tempo informado em `min:seg`.
  Com arquivo enviado, YouTube e Vimeo conta o tempo **assistido**; com código
  de player conta o tempo de página aberta. Opcionalmente, depoimentos e rodapé
  também ficam escondidos até o pitch. Quem já chegou no pitch vê tudo direto
  ao voltar (mudar o tempo do pitch zera isso).
- **Depoimentos**: imagens enviadas várias de uma vez (prints de WhatsApp,
  Instagram etc., em duas colunas no computador e uma no celular) e
  depoimentos escritos com nome, cidade, estrelas, texto, foto e imagem extra;
  adicionar, excluir e reordenar.
- **Rodapé** e **código no `<head>`** (Meta Pixel, UTMify, Google Tag).

Alterações aparecem na página pública em até ~1 minuto (cache do CDN). O botão
"Ver página" do painel abre uma versão sem cache logo depois de salvar.

## Página de vendas (`/oferta`, aba "Página de vendas" do painel)

Mini VSL no topo e carta de vendas abaixo: dor, por que acontece, produto,
resultados, a oferta como uma **ficha de receita** (o que a pessoa recebe,
bônus, chat 24h, preço e botão, com o carimbo da garantia), como recebe,
garantia, perguntas frequentes e P.S. No celular, uma barra fixa com o preço e
o botão aparece depois que o botão do topo sai da tela.

- Todos os textos, fotos, vídeo, preço, botão e cor são editáveis. Preço e link
  vazios usam os mesmos da VSL. Logo, favicon, depoimentos, pop-up de saída,
  rodapé e pixel são os mesmos da VSL.
- Nos textos: `**negrito**`, `==destaque==`, linha em branco = parágrafo,
  `- ` = lista; nas listas, `nome | descrição`.
- A mini VSL e as fotos padrão ficam em `public/media/` (vêm com o site).
- Métricas próprias (escolha "Página de vendas" na aba Métricas): "Chegaram na
  oferta" conta quem rolou até a ficha. Eventos do pixel: PageView, VideoPlay,
  VideoProgress, ViewContent + Pitch (ao ver a ficha) e InitiateCheckout.

## Métricas (aba "Métricas" do painel)

Precisa de um banco para gravar as visitas. Duas opções (o Supabase tem
prioridade se os dois estiverem configurados):

**Supabase pela integração da Vercel (mais fácil)**: Vercel → Storage →
Create Database → Supabase, conecte ao projeto e faça Redeploy. A integração
cria as variáveis sozinha e o site cria a tabela na primeira visita (usa a
conexão `POSTGRES_URL_NON_POOLING` só para isso).

**Supabase que você já tem**
1. No projeto do Supabase, abra **SQL Editor → New query**, cole o conteúdo de
   `sql/supabase-metricas.sql` e clique em **Run** (pode rodar de novo sem problema).
2. Em **Project Settings → API**, copie a **Project URL** e a chave **secreta**
   (`service_role` ou `sb_secret_...`; nunca a `anon`/publishable).
3. Na Vercel, em **Settings → Environment Variables**, crie `SUPABASE_URL` e
   `SUPABASE_SERVICE_ROLE_KEY` (marque como *Sensitive*) e faça **Redeploy**.

A tabela fica com RLS ligado e sem acesso para `anon`: só o servidor do site,
com a chave secreta, lê e grava.

**Upstash Redis**: Vercel → Storage → Create Database → Upstash → Redis (plano
grátis), conecte ao projeto e faça Redeploy.

- **Números**: visualizações, visitantes únicos, play rate, engajamento médio,
  quantos chegaram no pitch, quantos assistiram até o final e cliques no botão.
- **Curva de retenção** com a marcação do pitch; passe o mouse (ou use as
  setas) para ver quantos ainda assistiam em cada momento. Só conta tempo
  assistido em sequência — pular para a frente não infla a curva.
- **Visualizações por dia**, **dispositivo** e **origem** (`utm_source` do link
  ou o site de onde a pessoa veio).
- Períodos: hoje, ontem, 7, 30 e 90 dias (fuso de Brasília).
- **Zerar métricas** começa uma contagem nova (útil ao trocar o vídeo).

Como funciona: a página envia o estado da visita (`/api/t`) ao abrir, ao dar
play, ao chegar no pitch, ao clicar no botão e a cada ~15 s de vídeo — um único
comando no Redis por envio. Dias encerrados viram um resumo pronto, então os
relatórios ficam rápidos. Visitas com `?v=` ou `?notrack` no link (como o "Ver
página" do painel) não são contadas. Com código de player externo (VTurb,
Panda) só dá para contar visitas e cliques, porque esses players não informam o
tempo assistido.

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

## Área de membros (`/membros`, aba "Área de membros" do painel)

App do aluno: login com o e-mail da compra (a senha é criada no primeiro acesso),
módulos e aulas com progresso, bônus, materiais em PDF e o chat 24h com o
auxiliar veterinário virtual (IA da Anthropic, Claude).

- **Aulas:** no painel, módulos e aulas com vídeo enviado, link (YouTube, Vimeo,
  .mp4) ou código do player (Panda, VTurb), texto e materiais.
- **Alunos:** liberação automática pelo webhook da plataforma de vendas (compra
  aprovada libera; reembolso/chargeback bloqueia) ou à mão no painel; bloquear,
  zerar senha e excluir.
- **Chat:** cole a chave da API da Anthropic no painel (fica no banco, nunca volta
  para o navegador), escolha o modelo e o limite diário de mensagens por aluno.
- **Banco:** Supabase (tabelas `app_members`, `app_kv`, `app_chat_usage`, criadas
  sozinhas; SQL em `sql/area-membros.sql`).
