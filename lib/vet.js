// Chat do auxiliar veterinário virtual (Claude, API da Anthropic).
import Anthropic from '@anthropic-ai/sdk';

function systemPrompt(settings, course, member) {
  const modules = (course?.modules || [])
    .map((m) => `- ${m.title}${m.bonus ? ' (bônus)' : ''}: ${m.lessons.map((l) => l.title).join('; ')}`)
    .join('\n');
  return `Você é o ${settings.assistant_name}, o assistente virtual do guia "${course?.title || 'O Segredo dos Bifinhos Caseiros'}", um guia em videoaulas de receitas caseiras (bifinhos, petiscos, caldos) para cães, com foco em pele, pelo, coceira e mau cheiro. Você atende os alunos do guia pelo chat, 24 horas por dia.

Quem é você:
- Você é um assistente com inteligência artificial que ajuda com dúvidas de cuidado e alimentação. Se perguntarem se você é humano ou veterinário, diga com clareza que é um assistente virtual (IA) e que não substitui o veterinário.

Como responder:
- Português do Brasil, tom acolhedor e direto, como um auxiliar experiente conversando no WhatsApp.
- Respostas curtas: de 2 a 6 frases ou uma lista curta. Use no máximo 1 emoji quando combinar.
- Ajude com: ingredientes, substituições, preparo, conservação e validade dos bifinhos, porções por porte (petiscos devem somar no máximo cerca de 10% das calorias do dia), introdução gradual de alimentos novos, banho e cuidados com o pelo, e como usar o conteúdo do guia.
- Quando fizer sentido, indique o módulo do guia que trata do assunto.

Segurança (sempre):
- Não faça diagnóstico, não indique remédios nem doses. Para isso, oriente procurar o veterinário.
- Emergência: se o tutor relatar ingestão de chocolate, uva/passa, cebola, alho, xilitol, macadâmia ou outro tóxico; vômito ou diarreia com sangue ou que não para; convulsão; dificuldade para respirar; barriga inchada e dura; desmaio; ou feridas abertas e muito vermelhas, diga para levar ao veterinário ou pronto-socorro veterinário imediatamente, antes de qualquer outra orientação.
- Coceira intensa, queda de pelo em falhas, feridas ou cheiro muito forte que não melhora podem ser doença de pele, alergia ou parasitas: recomende avaliação veterinária além das receitas.
- Filhotes, cães idosos, gestantes ou com doença (rins, fígado, diabetes, pancreatite, alergia alimentar): recomende conversar com o veterinário antes de mudar a alimentação.
- Assuntos fora de cães, alimentação e cuidados: responda com gentileza que você só ajuda com dúvidas sobre o guia e o cuidado do cachorro.

Módulos do guia:
${modules || '- (sem módulos cadastrados)'}
${settings.instructions ? `\nInstruções do produtor:\n${settings.instructions}` : ''}`;
}

/** Valida o histórico vindo do navegador: só texto, papéis alternados, termina com o aluno. */
export function cleanHistory(raw) {
  const list = (Array.isArray(raw) ? raw : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 2000) }))
    .slice(-12);
  while (list.length && list[0].role !== 'user') list.shift();
  const out = [];
  for (const m of list) {
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += '\n' + m.content;
    else out.push(m);
  }
  return out.length && out[out.length - 1].role === 'user' ? out : [];
}

export class VetError extends Error {
  constructor(message, status = 500) { super(message); this.status = status; this.expose = true; }
}

export async function askVet({ settings, course, member, history }) {
  if (!settings.ai_key) throw new VetError('O chat ainda não foi ativado pelo produtor. Tente de novo mais tarde.', 503);
  const client = new Anthropic({ apiKey: settings.ai_key, maxRetries: 2, timeout: 60_000 });
  const model = settings.ai_model || 'claude-opus-5-5';
  const params = {
    model,
    max_tokens: 4000,
    system: systemPrompt(settings, course, member),
    cache_control: { type: 'ephemeral' },
    messages: history,
    output_config: { effort: 'low' }, // conversa curta: esforço baixo responde rápido e gasta menos
  };
  let response;
  try {
    // Opus/Sonnet 5.5: se o modelo recusar por segurança, a API tenta de novo num modelo reserva.
    response = model === 'claude-haiku-5-5'
      ? await client.messages.create(params)
      : await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('Chave da IA recusada:', err.status, err.message);
      throw new VetError('O chat está temporariamente indisponível. Avise o suporte, por favor.', 503);
    }
    if (err instanceof Anthropic.RateLimitError) throw new VetError('Muita gente usando o chat agora. Tente de novo em alguns segundos.', 429);
    if (err instanceof Anthropic.BadRequestError) {
      console.error('Pedido recusado pela API:', err.message);
      throw new VetError('Não consegui responder agora. Tente reformular a pergunta.', 400);
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Erro da API da IA:', err.status, err.message);
      throw new VetError('O chat está instável agora. Tente de novo em instantes.', 502);
    }
    console.error('Falha no chat:', err);
    throw new VetError('Não consegui responder agora. Tente de novo em instantes.', 502);
  }
  if (response.stop_reason === 'refusal') {
    return 'Prefiro não responder a isso por aqui. Se for uma dúvida de saúde do seu cachorro, o mais seguro é falar com o veterinário.';
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  return text || 'Desculpe, não consegui responder agora. Pode perguntar de novo?';
}

/** Teste da chave pelo painel: uma pergunta curtinha. */
export async function testKey(settings) {
  const reply = await askVet({ settings, course: null, member: null, history: [{ role: 'user', content: 'Responda só: chat funcionando.' }] });
  return reply;
}
