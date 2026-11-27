// Páginas depois da compra: /upsell (oferta única) e /downsell (para quem recusar).
// Copy pronta para os produtos sugeridos e validação dos campos.
import { mediaUrl, safeUrl, RATIOS } from './content.js';

export const UPSELL_PAGES = ['upsell', 'downsell'];

const BASE = {
  enabled: true,
  alert: 'Seu pedido foi aprovado ✓ Não feche esta página: preparamos uma condição que só aparece agora.',
  video: { type: 'none', file: '', url: '', embed: '', ratio: '9:16', autoplay: false, pause_image: '' },
  cta_color: '#0e7a37',
  cta_code: '', // código de "compra com 1 clique" da plataforma (substitui o botão)
  pay_note: 'Compra com 1 clique, no mesmo cartão ou Pix · Acesso no mesmo login',
  guarantee_title: 'Garantia de 7 dias',
  guarantee_text: 'Se não gostar, é só pedir o reembolso em até 7 dias e devolvemos 100% do valor. Sem perguntas.',
};

export function upsellDefaults(page = 'upsell') {
  if (page === 'downsell') {
    return {
      ...BASE,
      alert: 'Espere! Antes de ir para o seu acesso, uma última condição.',
      tag: 'Versão essencial · só nesta página',
      headline: 'Resolva os ==3 comportamentos que mais irritam== no dia a dia com o seu cachorro',
      subheadline: 'Entendemos que o programa completo pode não ser para agora. Então separamos só o essencial, para você começar hoje, por um valor bem menor.',
      problems_title: 'Os 3 que mais tiram a paz da casa',
      problems: `Xixi e cocô fora do lugar, mesmo depois de tanta bronca
Latir para tudo: campainha, moto, vizinho, folha caindo
Puxar a guia no passeio até o seu braço doer`,
      includes_title: 'O que você recebe',
      includes: `🚽 Xixi no lugar certo | O passo a passo para ensinar, mesmo em apartamento
🔕 Fim do latido sem motivo | Como acalmar e redirecionar, sem gritar e sem castigo
🦮 Passeio sem puxão | A técnica simples para ele andar ao seu lado
📱 Aulas curtas em vídeo | Assista no celular, no mesmo acesso dos bifinhos`,
      offer_text: 'de R$ 47 por R$ 12,87',
      offer_note: 'Pagamento único. Menos que um pacote de petisco.',
      cta_text: 'SIM, QUERO OS 3 COMPORTAMENTOS',
      cta_url: '',
      decline_text: 'Não, obrigado. Quero ir para o meu acesso.',
      decline_url: '/membros',
      ps: '',
    };
  }
  return {
    ...BASE,
    tag: 'Oferta única para quem acabou de comprar',
    headline: 'Agora que a pele e o pelo estão resolvidos, que tal ter um ==cachorro educado em 21 dias==?',
    subheadline: 'O seu cachorro vai ficar mais saudável e cheiroso. Agora imagine ele também obedecendo, passeando sem puxar e sem destruir a casa enquanto você está fora.',
    problems_title: 'Você se reconhece em alguma dessas?',
    problems: `Ele puxa a guia e o passeio vira um cabo de guerra
Late para tudo e os vizinhos já reclamaram
Faz xixi fora do lugar, mesmo depois de tanta bronca
Destrói chinelo, sofá e almofada quando fica sozinho
Pula em todo mundo que chega na sua casa`,
    includes_title: 'O que você recebe no Cachorro Educado em 21 Dias',
    includes: `🗓️ Plano de 21 dias, 10 minutos por dia | Um exercício por dia, do mais simples ao mais avançado
🦮 Passeio sem puxão | Ele andando ao seu lado, sem arrastar você pela rua
🔕 Fim do latido sem motivo | Como acalmar e redirecionar, sem gritar e sem castigo
🚽 Xixi no lugar certo | O passo a passo para ensinar, mesmo em apartamento
🛋️ Sozinho sem destruir | Como ele fica tranquilo quando você sai de casa
🐾 Patinhas protegidas | Cuidados no passeio com o asfalto quente e o chão áspero`,
    offer_text: 'de R$ 97 por R$ 47',
    offer_note: 'Pagamento único. Só nesta página: depois de sair, o valor volta para R$ 97.',
    cta_text: 'SIM, QUERO MEU CACHORRO EDUCADO',
    cta_url: '',
    decline_text: 'Não, obrigado. Prefiro continuar só com os bifinhos.',
    decline_url: '/downsell',
    ps: '**P.S.** É o mesmo acesso dos bifinhos, no mesmo login. Você não precisa digitar o cartão de novo.',
  };
}

export function upsellsDefaults() {
  return { upsell: upsellDefaults('upsell'), downsell: upsellDefaults('downsell') };
}

const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const COLOR = /^#[0-9a-f]{6}$/i;
// Link de recusa: caminho do próprio site (/downsell, /membros) ou https://
const link = (v) => { const s = String(v ?? '').trim(); return /^\/[\w\-/?=&.%]*$/.test(s) ? s.slice(0, 300) : safeUrl(s); };

function sanitizePage(input, page) {
  const d = upsellDefaults(page);
  const i = input && typeof input === 'object' ? input : {};
  const v = i.video && typeof i.video === 'object' ? i.video : {};
  const pick = (k, max) => (k in i ? str(i[k], max) : d[k]);
  return {
    enabled: 'enabled' in i ? Boolean(i.enabled) : d.enabled,
    alert: pick('alert', 300),
    tag: pick('tag', 200),
    headline: pick('headline', 400),
    subheadline: pick('subheadline', 800),
    video: {
      type: ['upload', 'url', 'embed', 'none'].includes(v.type) ? v.type : d.video.type,
      file: mediaUrl(v.file),
      url: safeUrl(v.url),
      embed: String(v.embed ?? '').slice(0, 20000),
      ratio: RATIOS.includes(v.ratio) ? v.ratio : d.video.ratio,
      autoplay: 'autoplay' in v ? Boolean(v.autoplay) : d.video.autoplay,
      pause_image: mediaUrl(v.pause_image),
    },
    problems_title: pick('problems_title', 200),
    problems: pick('problems', 3000),
    includes_title: pick('includes_title', 200),
    includes: pick('includes', 4000),
    offer_text: pick('offer_text', 200),
    offer_note: pick('offer_note', 300),
    cta_text: pick('cta_text', 80) || d.cta_text,
    cta_url: 'cta_url' in i ? safeUrl(i.cta_url) : d.cta_url,
    cta_code: String(i.cta_code ?? '').slice(0, 20000),
    cta_color: COLOR.test(String(i.cta_color)) ? String(i.cta_color).toLowerCase() : d.cta_color,
    pay_note: pick('pay_note', 200),
    decline_text: pick('decline_text', 200),
    decline_url: 'decline_url' in i ? link(i.decline_url) : d.decline_url,
    guarantee_title: pick('guarantee_title', 200),
    guarantee_text: pick('guarantee_text', 1000),
    ps: pick('ps', 2000),
  };
}

export function sanitizeUpsells(input) {
  const i = input && typeof input === 'object' ? input : {};
  return Object.fromEntries(UPSELL_PAGES.map((p) => [p, sanitizePage(i[p], p)]));
}

export function upsellsMedia(u) {
  return UPSELL_PAGES.flatMap((p) => [u?.[p]?.video?.file, u?.[p]?.video?.pause_image]).filter(Boolean);
}
