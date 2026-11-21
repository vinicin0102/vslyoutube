// Conteúdo da página de vendas (/oferta): copy pronta para o produto e validação dos campos.
import { mediaUrl, safeUrl, RATIOS } from './content.js';

export function salesDefaults() {
  return {
    enabled: true,
    tag: 'Para quem tem cachorro que vive se coçando',
    headline: 'O segredo dos bifinhos caseiros que ajudam a acabar com a ==coceira e o mau cheiro== do seu cachorro',
    subheadline:
      'Receitas simples, com ingredientes de mercado, que cuidam da pele e do pelo de dentro pra fora. Mesmo que você já tenha tentado shampoo, pomada e ração cara.',
    video: { type: 'upload', file: '/media/mini-vsl.mp4', url: '', embed: '', ratio: '9:16', autoplay: true, pause_image: '' },
    cta_text: 'QUERO O SEGREDO DOS BIFINHOS',
    cta_url: '', // vazio = o mesmo checkout da VSL
    cta_color: '#e8590c',
    offer_text: '', // vazio = o mesmo preço da VSL
    pay_note: 'Pagamento seguro · Pix ou cartão · Acesso imediato no e-mail',
    brand_name: '', // vazio = o mesmo da VSL
    logo: '',
    favicon: '',
    show_testimonials: true,
    testimonials_title: 'Quem já faz os bifinhos em casa',
    testimonial_images: [], // vazio = usa as imagens de depoimentos da VSL
    intro: `Se você chegou até aqui, provavelmente conhece essa cena.

É de madrugada e você acorda com o barulho. **A pata batendo no chão, sem parar.** Ele se coça, lambe, morde a própria pele até ficar vermelha.

De manhã você dá banho, passa perfume… e dois dias depois **aquele cheiro forte está de volta**: no sofá, na cama, na sua roupa.

Você não está sozinho. E não é falta de cuidado.`,
    img1: '/media/coceira.jpg',
    img1_caption: 'toda noite a mesma cena…',
    story: `Você provavelmente já fez de tudo:

- Trocou de shampoo mais de uma vez
- Comprou pomada, spray e ração premium
- Gastou com banho no pet shop toda semana

E cada vez é a mesma coisa: **melhora alguns dias e volta tudo.** A coceira, o cheiro, o pelo caindo pela casa.

O que quase ninguém conta é que muitas vezes o problema não começa na pele. ==Começa no pote de comida.==`,
    mechanism_title: 'Por que a coceira e o cheiro sempre voltam',
    mechanism: `A pele e o pelo do seu cachorro refletem o que ele come todos os dias. Petiscos industrializados, cheios de corantes, conservantes e farinhas pobres, podem deixar a pele mais sensível. E nenhum shampoo resolve o que começa por dentro.

**A boa notícia é que pequenas trocas fazem diferença.** Trocar o petisco do dia a dia por bifinhos caseiros, feitos com ingredientes simples como aveia, abóbora e óleo de coco, é uma das formas mais fáceis de cuidar da pele dele de dentro pra fora.

Foi exatamente isso que eu reuni num guia simples, passo a passo.`,
    img2: '/media/cozinha.jpg',
    img2_caption: 'feito em casa, em poucos minutos',
    product_title: 'Conheça o Segredo dos Bifinhos Caseiros',
    product_text:
      'Um guia completo em videoaulas curtas para você preparar em casa, sem complicação, os petiscos e receitas que o seu cachorro vai amar, e que cuidam da saúde dele de verdade.',
    product_image: '/media/guia.png',
    results_title: 'O que muda na rotina de vocês',
    results: `Mais noites tranquilas, sem a pata batendo no chão
Pelo mais macio, brilhante e cheiroso por mais tempo
Petiscos sem corante e sem conservante, feitos por você
Menos gasto com shampoo, pomada e banho no pet shop`,
    results_image: '/media/feliz.jpg',
    card_title: 'O Segredo dos Bifinhos Caseiros',
    includes: `Videoaulas passo a passo, para assistir no celular
Bifinhos caseiros que ajudam a acabar com a coceira
Petiscos que ajudam a combater o mau cheiro
Receitas para ele viver mais e com mais disposição
A quantidade certa para cada porte, do pequeno ao grande`,
    bonus_title: 'Bônus exclusivos',
    bonus: `🛁 Shampoo caseiro | Receita natural para o pelo ficar cheiroso e macio
🚫 Lista negra de alimentos | O que o seu cachorro nunca pode comer
🛒 Lista de compras | Tudo o que você precisa, numa lista só`,
    support_title: 'Chat 24h com auxiliar veterinário',
    support_text: 'Ficou com dúvida em alguma receita, na quantidade ou num ingrediente? Pergunte o que quiser, a qualquer hora, e receba a resposta de um auxiliar veterinário.',
    offer_intro: 'Você já gastou muito mais do que isso com shampoo, pomada e ração que não resolveram. Hoje você leva tudo por menos que um banho no pet shop:',
    steps_title: 'Como você recebe',
    steps: `Finalize a compra | No Pix ou no cartão, em menos de 1 minuto
Receba no seu e-mail | O acesso chega na hora, com login e senha
Comece hoje mesmo | Assista no celular ou no computador, quando quiser`,
    guarantee_title: 'Garantia incondicional de 7 dias',
    guarantee_text:
      'Experimente o guia por 7 dias. Se por qualquer motivo você não gostar, é só pedir o reembolso e devolvemos 100% do seu dinheiro. Sem perguntas e sem burocracia. O risco é todo nosso.',
    faq_title: 'Perguntas frequentes',
    faq: `Preciso ter experiência na cozinha? | Não. As receitas são simples e cada passo é mostrado em vídeo.
Serve para qualquer raça e idade? | Sim. O guia mostra a quantidade certa para cada porte. Para filhotes, cães idosos ou com alguma doença, converse antes com o veterinário dele.
Os ingredientes são caros? | Não. São ingredientes comuns, que você encontra em qualquer mercado.
Como vou receber o acesso? | Logo depois da compra você recebe no seu e-mail o acesso à área de membros, para assistir no celular ou no computador.
Como funciona o chat com o auxiliar veterinário? | Dentro da área de membros você tem um chat aberto 24 horas para tirar dúvidas sobre as receitas, as quantidades e os ingredientes.
O guia substitui o veterinário? | Não. Ele ajuda no dia a dia, mas coceira muito forte, feridas abertas ou queda de pelo intensa precisam ser avaliadas por um veterinário.`,
    ps: '**P.S.** Toda noite que passa é mais uma noite dele se coçando. Por menos que um banho no pet shop, você aprende a fazer os bifinhos hoje mesmo, e ainda tem 7 dias de garantia para testar sem risco.',
  };
}

const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const COLOR = /^#[0-9a-f]{6}$/i;

export function sanitizeSales(input) {
  const d = salesDefaults();
  const i = input && typeof input === 'object' ? input : {};
  const v = i.video && typeof i.video === 'object' ? i.video : {};
  const pick = (k, max) => (k in i ? str(i[k], max) : d[k]);
  const img = (k) => (k in i ? mediaUrl(i[k]) : d[k]);
  return {
    enabled: 'enabled' in i ? Boolean(i.enabled) : d.enabled,
    tag: pick('tag', 200),
    headline: pick('headline', 400),
    subheadline: pick('subheadline', 600),
    video: {
      type: ['upload', 'url', 'embed', 'none'].includes(v.type) ? v.type : d.video.type,
      file: 'file' in v ? mediaUrl(v.file) : d.video.file,
      url: safeUrl(v.url),
      embed: String(v.embed ?? '').slice(0, 20000),
      ratio: RATIOS.includes(v.ratio) ? v.ratio : d.video.ratio,
      autoplay: 'autoplay' in v ? Boolean(v.autoplay) : d.video.autoplay,
      pause_image: mediaUrl(v.pause_image),
    },
    cta_text: pick('cta_text', 80) || d.cta_text,
    cta_url: 'cta_url' in i ? safeUrl(i.cta_url) : d.cta_url,
    cta_color: COLOR.test(String(i.cta_color)) ? String(i.cta_color).toLowerCase() : d.cta_color,
    offer_text: pick('offer_text', 300),
    pay_note: pick('pay_note', 200),
    brand_name: pick('brand_name', 80),
    logo: mediaUrl(i.logo),
    favicon: mediaUrl(i.favicon),
    show_testimonials: 'show_testimonials' in i ? Boolean(i.show_testimonials) : d.show_testimonials,
    testimonials_title: pick('testimonials_title', 200),
    testimonial_images: (Array.isArray(i.testimonial_images) ? i.testimonial_images : []).map(mediaUrl).filter(Boolean).slice(0, 60),
    intro: pick('intro', 6000),
    img1: img('img1'),
    img1_caption: pick('img1_caption', 200),
    story: pick('story', 6000),
    mechanism_title: pick('mechanism_title', 200),
    mechanism: pick('mechanism', 6000),
    img2: img('img2'),
    img2_caption: pick('img2_caption', 200),
    product_title: pick('product_title', 200),
    product_text: pick('product_text', 3000),
    product_image: img('product_image'),
    results_title: pick('results_title', 200),
    results: pick('results', 3000),
    results_image: img('results_image'),
    card_title: pick('card_title', 200),
    includes: pick('includes', 3000),
    bonus_title: pick('bonus_title', 200),
    bonus: pick('bonus', 3000),
    support_title: pick('support_title', 200),
    support_text: pick('support_text', 1000),
    offer_intro: pick('offer_intro', 2000),
    steps_title: pick('steps_title', 200),
    steps: pick('steps', 2000),
    guarantee_title: pick('guarantee_title', 200),
    guarantee_text: pick('guarantee_text', 2000),
    faq_title: pick('faq_title', 200),
    faq: pick('faq', 8000),
    ps: pick('ps', 3000),
  };
}

export function salesMedia(t) {
  return [t.logo, t.favicon, t.video.file, t.video.pause_image, t.img1, t.img2, t.product_image, t.results_image, ...(t.testimonial_images || [])].filter(Boolean);
}
