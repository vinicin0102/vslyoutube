// Conteúdo do curso (módulos e aulas) e configurações da área de membros.
import { mediaUrl, safeUrl } from './content.js';
import { randomBytes } from 'node:crypto';

const rid = () => randomBytes(5).toString('hex');
const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);

const lesson = (title, description = '', extra = {}) => ({ id: rid(), title, description, video: { type: 'none', file: '', url: '', embed: '' }, text: '', materials: [], ...extra });

const LISTA_NEGRA = `**Nunca dê ao seu cachorro** (nem um pedacinho):

- **Chocolate e cacau**: a teobromina é tóxica, principalmente o amargo e o meio amargo
- **Uva e uva-passa**: podem causar insuficiência renal, mesmo em pouca quantidade
- **Cebola, alho, alho-poró e cebolinha** (crus, cozidos ou em pó): danificam as células do sangue
- **Xilitol** (adoçante de chicletes, balas, pasta de amendoim "diet" e alguns doces): queda brusca de açúcar no sangue e risco para o fígado
- **Macadâmia**: fraqueza, tremores e febre
- **Café, chá preto, energéticos e qualquer cafeína**
- **Bebida alcoólica** e massa crua com fermento
- **Abacate** (caroço, casca e folhas principalmente)
- **Ossos cozidos**: lascam e podem perfurar o intestino
- **Comida muito salgada, gordurosa ou temperada** (embutidos, frituras, restos de churrasco)
- **Caroços e sementes** de frutas (maçã, pêssego, ameixa, cereja)

**Se ele comer algum desses alimentos**, não espere sintomas: ligue ou leve ao veterinário na hora e diga o que ele comeu, quanto e há quanto tempo.`;

const LISTA_COMPRAS = `Itens básicos para começar a fazer os bifinhos e petiscos em casa:

- Aveia em flocos (sem açúcar)
- Abóbora (cabotiá ou moranga)
- Batata-doce
- Cenoura
- Peito de frango ou carne moída magra
- Ovos
- Óleo de coco
- Maçã (sem as sementes)
- Banana
- Farinha de arroz ou farinha de aveia
- Fôrma de silicone e papel-manteiga

**Dica:** compre sem tempero e sem sal. Tudo o que for para ele é preparado sem cebola, alho ou condimentos.`;

const WELCOME_VIDEO = '/media/boas-vindas.mp4';

export function courseDefaults() {
  return {
    welcome_video: true,
    title: 'O Segredo dos Bifinhos Caseiros',
    welcome: 'Que bom ter você aqui! Comece pelo primeiro módulo e, se tiver qualquer dúvida, chame o auxiliar no chat.',
    modules: [
      { id: rid(), title: 'Comece por aqui', description: 'Boas-vindas e como aproveitar o guia', cover: '', bonus: false,
        lessons: [lesson('Boas-vindas', 'Como funciona o guia e por onde começar', { video: { type: 'upload', file: WELCOME_VIDEO, url: '', embed: '' } }), lesson('Porções certas para cada porte', 'Quanto oferecer para cães pequenos, médios e grandes')] },
      { id: rid(), title: 'Bifinhos contra a coceira', description: 'Receitas que cuidam da pele de dentro pra fora', cover: '', bonus: false,
        lessons: [lesson('Bifinho de aveia e abóbora'), lesson('Bifinho de batata-doce e frango'), lesson('Bifinho de óleo de coco')] },
      { id: rid(), title: 'Petiscos contra o mau cheiro', description: 'Petiscos que ajudam a combater o cheiro forte', cover: '', bonus: false,
        lessons: [lesson('Petisco de maçã e aveia'), lesson('Petisco de cenoura')] },
      { id: rid(), title: 'Receitas para viver mais', description: 'Mais saúde e disposição no dia a dia', cover: '', bonus: false,
        lessons: [lesson('Caldinho nutritivo'), lesson('Sorvetinho de banana')] },
      { id: rid(), title: 'Shampoo potencializador de resultados', description: 'Ajuda a acabar com o mau cheiro e as bactérias e deixa o pelo macio e sedoso', cover: '', bonus: true,
        lessons: [lesson('Como preparar o shampoo caseiro', 'Passo a passo do preparo e como usar no banho')] },
      { id: rid(), title: 'Lista negra de alimentos', description: 'O que o seu cachorro nunca pode comer', cover: '', bonus: true,
        lessons: [lesson('Alimentos proibidos', 'Guarde esta lista e mostre para toda a família', { text: LISTA_NEGRA })] },
      { id: rid(), title: 'Lista de compras', description: 'Tudo o que você precisa, numa lista só', cover: '', bonus: true,
        lessons: [lesson('Sua lista de compras', 'Leve no celular quando for ao mercado', { text: LISTA_COMPRAS })] },
    ],
  };
}

function sanitizeVideo(v) {
  v = v && typeof v === 'object' ? v : {};
  return {
    type: ['upload', 'url', 'embed', 'none'].includes(v.type) ? v.type : 'none',
    file: mediaUrl(v.file),
    url: safeUrl(v.url),
    embed: String(v.embed ?? '').slice(0, 20000),
  };
}

export function sanitizeCourse(input) {
  const i = input && typeof input === 'object' ? input : courseDefaults();
  const mods = Array.isArray(i.modules) ? i.modules.slice(0, 60) : [];
  // Uma vez só: coloca o vídeo de boas-vindas pronto na aula "Boas-vindas" que ainda está sem vídeo.
  if (!i.welcome_video) {
    for (const m of mods) for (const l of m?.lessons || []) {
      if (/^boas[- ]vindas$/i.test(String(l?.title || '').trim()) && (!l.video || l.video.type === 'none' || (l.video.type === 'upload' && !l.video.file))) {
        l.video = { type: 'upload', file: WELCOME_VIDEO, url: '', embed: '' };
      }
    }
  }
  return {
    welcome_video: true,
    title: str(i.title, 160),
    welcome: str(i.welcome, 1000),
    modules: mods.map((m) => ({
      id: /^[a-z0-9]{6,20}$/.test(m?.id) ? m.id : rid(),
      title: str(m?.title, 160) || 'Módulo',
      description: str(m?.description, 400),
      cover: mediaUrl(m?.cover),
      bonus: Boolean(m?.bonus),
      lessons: (Array.isArray(m?.lessons) ? m.lessons.slice(0, 120) : []).map((l) => ({
        id: /^[a-z0-9]{6,20}$/.test(l?.id) ? l.id : rid(),
        title: str(l?.title, 160) || 'Aula',
        description: str(l?.description, 1000),
        video: sanitizeVideo(l?.video),
        text: str(l?.text, 20000),
        materials: (Array.isArray(l?.materials) ? l.materials.slice(0, 20) : [])
          .map((x) => ({ label: str(x?.label, 120) || 'Material', url: mediaUrl(x?.url) || safeUrl(x?.url) }))
          .filter((x) => x.url),
      })),
    })),
  };
}

/* ---------- configurações (a chave da IA nunca volta para o navegador) ---------- */

// Provedor da IA do chat e modelos de cada um.
export const PROVIDERS = {
  deepseek: { label: 'DeepSeek', models: { 'deepseek-chat': 'DeepSeek V3 (recomendado: rápido e barato)', 'deepseek-reasoner': 'DeepSeek R1 (pensa mais, mais lento)' } },
  anthropic: { label: 'Anthropic (Claude)', models: { 'claude-opus-5-5': 'Claude Opus 5.5 (melhor qualidade)', 'claude-sonnet-5-5': 'Claude Sonnet 5.5', 'claude-haiku-5-5': 'Claude Haiku 5.5 (o mais barato)' } },
};

export function settingsDefaults() {
  return {
    ai_key: '',
    ai_provider: 'deepseek',
    ai_model: 'deepseek-chat',
    chat_limit: 30,
    assistant_name: 'Auxiliar Veterinário',
    instructions: '',
    support: '',
    app_name: '',
    app_icon: '',
    meta_tokens: {},      // { idDoPixel: tokenDaApiDeConversoes }
    meta_test_code: '',   // código de teste do Gerenciador de Eventos (opcional)
    capi_purchase: true,  // enviar a compra aprovada (webhook) pelo servidor
    webhook_token: randomBytes(18).toString('base64url'),
  };
}

export function sanitizeSettings(input, old) {
  const d = old || settingsDefaults();
  const i = input && typeof input === 'object' ? input : {};
  const key = typeof i.ai_key === 'string' ? i.ai_key.trim() : null;
  return {
    // vazio = mantém a atual; "-" = apaga
    ai_key: key === null || key === '' ? d.ai_key : key === '-' ? '' : key.slice(0, 300),
    ai_provider: PROVIDERS[i.ai_provider] ? i.ai_provider : PROVIDERS[d.ai_provider] ? d.ai_provider : 'deepseek',
    ai_model: (() => {
      const prov = PROVIDERS[i.ai_provider] ? i.ai_provider : PROVIDERS[d.ai_provider] ? d.ai_provider : 'deepseek';
      const models = PROVIDERS[prov].models;
      if (models[i.ai_model]) return i.ai_model;
      if (models[d.ai_model]) return d.ai_model;
      return Object.keys(models)[0];
    })(),
    chat_limit: Math.max(1, Math.min(500, Math.floor(Number(i.chat_limit ?? d.chat_limit)) || 30)),
    assistant_name: str(i.assistant_name ?? d.assistant_name, 60) || 'Auxiliar Veterinário',
    instructions: str(i.instructions ?? d.instructions, 4000),
    support: str(i.support ?? d.support, 300),
    meta_tokens: (() => {
      // vazio = mantém; "-" = apaga o token daquele pixel
      const out = { ...(d.meta_tokens || {}) };
      const inp = i.meta_tokens && typeof i.meta_tokens === 'object' ? i.meta_tokens : {};
      for (const [id, tok] of Object.entries(inp)) {
        if (!/^\d{5,20}$/.test(id)) continue;
        const t = String(tok || '').trim();
        if (t === '-') delete out[id];
        else if (t) out[id] = t.slice(0, 600);
      }
      return out;
    })(),
    meta_test_code: str(i.meta_test_code ?? d.meta_test_code, 40),
    capi_purchase: 'capi_purchase' in i ? Boolean(i.capi_purchase) : d.capi_purchase !== false,
    app_name: str(i.app_name ?? d.app_name, 40),
    app_icon: 'app_icon' in i ? mediaUrl(i.app_icon) : d.app_icon || '',
    webhook_token: i.new_webhook_token ? randomBytes(18).toString('base64url') : d.webhook_token || randomBytes(18).toString('base64url'),
  };
}

/** O que o painel pode ver (sem a chave). */
export function publicSettings(s) {
  const { ai_key, meta_tokens, ...rest } = s;
  return { ...rest, meta_tokens_set: Object.fromEntries(Object.entries(meta_tokens || {}).map(([id, t]) => [id, '…' + t.slice(-4)])), ai_key_set: Boolean(ai_key), ai_key_hint: ai_key ? '…' + ai_key.slice(-4) : '', providers: PROVIDERS };
}
