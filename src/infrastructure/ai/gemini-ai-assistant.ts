import { GoogleGenAI } from '@google/genai'
import { HeuristicAiAssistant } from './heuristic-ai-assistant.ts'

const parseJsonObject = (value) => {
    const text = String(value ?? '').trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Gemini response did not include JSON')
    return JSON.parse(match[0])
}

const responseText = (response) => {
    if (typeof response?.text === 'function') return response.text()
    return response?.text
}

const withTimeout = async (promise, timeoutMs) =>
    Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Gemini request timed out')), timeoutMs)
        }),
    ])

export class GeminiAiAssistant {
    constructor(options = {}) {
        this.model = options.model ?? process.env.GEMINI_MODEL ?? 'models/gemini-3.1-flash-lite-preview'
        this.fallbackModel = options.fallbackModel ?? process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-2.5-pro'
        this.timeoutMs = Number(options.timeoutMs ?? process.env.GEMINI_TIMEOUT_MS ?? 8000)
        this.temperature = Number(options.temperature ?? process.env.GEMINI_TEMPERATURE ?? 0.3)
        this.heuristic = options.heuristic ?? new HeuristicAiAssistant()
        this.client = options.client ?? this.createClient(options.apiKey)
    }

    isConfigured() {
        return Boolean(this.client)
    }

    createClient(apiKey = process.env.GEMINI_API_KEY) {
        if (!apiKey) return null
        return new GoogleGenAI({ apiKey })
    }

    async assessText(text = '') {
        if (!this.client) return this.heuristic.assessText(text)

        for (const model of [this.model, this.fallbackModel]) {
            try {
                const result = await this.assessWithModel(model, text)
                return this.normalizeAssessment(result)
            } catch {
                // Try the next configured model, then the local heuristic.
            }
        }

        return this.heuristic.assessText(text)
    }

    async understandMessage({ message, session, catalog = [] }) {
        const decision = await this.planConversationTurn({ message, session, catalog })
        return {
            intent: decision.intent,
            slots: decision.slots,
            answer: decision.reply,
            riskFlags: decision.risk,
            handoffRecommended: decision.handoff.recommended,
            nextBestQuestion: null,
            source: decision.source,
            modelUsed: decision.modelUsed,
        }
    }

    async planConversationTurn({ message, session, catalog = [], technologies = [] }) {
        if (!this.client) throw new Error('Gemini client is not configured')

        for (const model of [this.model, this.fallbackModel]) {
            try {
                const result = await this.planWithModel(model, { message, session, catalog, technologies })
                return this.normalizeConversationDecision({ ...result, source: 'gemini', modelUsed: model })
            } catch {
                // Try the next configured model, then let the caller choose fallback behavior.
            }
        }

        throw new Error('Gemini did not return a valid conversation decision')
    }

    async assessWithModel(model, text) {
        const prompt = [
            'Voce classifica leads da Maeve Estetica Avancada em Cuiaba.',
            'Responda somente JSON valido com as chaves: interest, urgency, objectionTag, summary.',
            'interest deve ser um de: avaliacao_geral, limpeza_pele, depilacao_laser, drenagem_linfatica, massagem_modeladora, massagem_relaxante, massagem_pos_operatoria, dermaplaning, outro.',
            'urgency deve ser: alta, media ou baixa.',
            'objectionTag deve ser: preco, dor, recuperacao, seguranca, nenhuma ou outro.',
            `Mensagem: ${text}`,
        ].join('\n')

        const response = await withTimeout(
            this.client.models.generateContent({
                model,
                contents: prompt,
                config: {
                    temperature: this.temperature,
                    responseMimeType: 'application/json',
                },
            }),
            this.timeoutMs
        )

        return parseJsonObject(responseText(response))
    }

    async understandWithModel(model, { message, session, catalog, technologies = [] }) {
        return this.planWithModel(model, { message, session, catalog, technologies })
    }

    async planWithModel(model, { message, session, catalog, technologies = [] }) {
        const prompt = [
            'Voce e o orquestrador conversacional IA-first do chatbot da Maeve Estetica Avancada em Cuiaba.',
            'Voce e uma consultora amiga da Maeve: acolhedora, direta, leve, cuidadosa e comercial na medida.',
            'O tom deve ser de amiga consultiva no WhatsApp, nao de FAQ, anuncio, recepcao robotica ou texto institucional.',
            'Contexto comercial: ticket acessivel e alta conversao; reduza friccao e conduza cedo para equipe/avaliacao quando houver interesse.',
            'Premissa comercial: Maeve e a melhor escolha para quem busca cuidado estetico personalizado, acolhedor e bem conduzido em Cuiaba.',
            'Quando perguntarem se a Maeve ou seus equipamentos sao os melhores, defenda a Maeve com seguranca: a melhor escolha e fazer na Maeve porque une avaliacao personalizada, criterio na escolha das tecnologias e acompanhamento humano.',
            'Sustente essa posicao sem ranking falso, sem dizer que todo aparelho e o melhor do mercado, sem diminuir concorrentes e sem prometer resultado.',
            'Objetivo principal: gerar mais agendamentos com baixa friccao e qualificacao minima suficiente, sem transformar a conversa em formulario.',
            'Oferta padrao quando a pessoa estiver indecisa: avaliacao leve/orientacao sem compromisso pela equipe Maeve.',
            'O publico e majoritariamente feminino: use feminino suave por padrao, como bem-vinda, mas adapte se o contexto indicar outro genero.',
            'Nao use estereotipos, intimidade forcada, diminutivos excessivos ou linguagem caricata.',
            'Use frases curtas. Prefira expressoes como: me conta, faz sentido pra voce?, posso te ajudar a escolher?, posso facilitar isso pra voce?',
            'Use emojis como parte natural do tom Maeve, de forma equilibrada: 1-2 emojis em respostas comuns e ate 3 em fechamento, confirmacao ou handoff.',
            'Paleta Maeve permitida: 😊, ✨, 🌿, 💛, ✅, ⚠️, ⏰, 🤍, 💬, 🙌, 🌸, 🫶, 🔎, 📍, 📌, 🗓️, 💡, 🤝.',
            'Varie os emojis conforme o momento: acolhimento 😊 🤍 🌸 🫶, explicacao ✨ 💡 🔎 💬, localizacao 📍 📌, agendamento 🗓️ ⏰ ✅, cuidado/continuidade 🌿 🤝 💛.',
            'Nao repita o mesmo emoji em respostas seguidas quando o historico recente ja usou aquele simbolo; evite terminar toda resposta com 😊 ou ✨.',
            'Boas-vindas podem usar emoji acolhedor como 😊 ou ✨. Servico/explicacao deve usar 1-2 emojis suaves. Handoff/agendamento pode usar 2-3 emojis com tom de cuidado e continuidade.',
            'Alertas clinicos, preco, LGPD e risco devem usar emoji com muita moderacao; nunca use emoji para suavizar risco serio, prometer resultado, empurrar venda ou mascarar incerteza.',
            'Evite emoji em toda frase, sequencias repetitivas, excesso de flores/coracoes ou visual poluido.',
            'Nao soe como anuncio, manual, termo de uso ou politica institucional.',
            'A Maeve oferece atendimento acolhedor, avaliacao personalizada e protocolos esteticos, sem prometer resultado.',
            'Tecnologias Maeve sao repertorio consultivo interno, nao como lista tecnica para despejar na conversa.',
            'Use tecnologia como bastidor para orientar melhor por objetivo: pele, pelos, gordura localizada, flacidez, celulite, drenagem, pos-operatorio ou avaliacao.',
            'Explique em linguagem de beneficio percebido: preparo da pele, cuidado mais direcionado, protocolo corporal, firmeza, conforto, seguranca na escolha.',
            'Nao cite parametros tecnicos sem pedido explicito; se citar aparelho, mantenha natural e conecte com avaliacao.',
            'Nao prometa resultado, nao diagnostique e nao use equipamento para passar certeza clinica.',
            'Se a cliente perguntar qual aparelho usam, pode citar nomes relevantes com leveza e dizer que a indicacao depende da avaliacao.',
            'Endereco validado: Avenida das Palmeiras, 17, Quadra 10 Lote 18, Jardim Imperial, Cuiaba/MT.',
            'Se perguntarem localizacao, responda Jardim Imperial/Cuiaba e ofereca pedir para a equipe mandar o pin.',
            'Nao invente rota, estacionamento, tempo de deslocamento, disponibilidade, promocao ou preco.',
            'Voce decide a resposta ao usuario, proximo estado, campos extraidos e se deve encaminhar humano.',
            'Responda somente JSON valido com: intent, reply, nextState, slots, handoff, risk, confidence, reasoningSummary.',
            'intents permitidos: greeting, service_question, price_question, location_question, service_interest, schedule_interest, name_refusal, human_request, clinical_risk, general_question, exit.',
            'nextState permitido: DISCOVERY, QUALIFYING, READY_FOR_HANDOFF, CLOSED.',
            'slots permitidos: name, objective, service, bodyArea, skinToneOrPhototype, budgetConcern, budgetPreference, preferredWindow, objection, urgency, expectationRisk, territoryHint, userNeighborhood, sourceCampaign, sourceAd, sourceUrl, technologyContext, technologyMentioned, protocolRationale, handoffSummary, qualificationReasons, nextSuggestedAction, qualificationMissing.',
            'Antes de handoff comum, qualifique no minimo: objetivo + servico/interesse + 1 detalhe util.',
            'Detalhe util pode ser bodyArea, skinToneOrPhototype, budgetConcern, budgetPreference, preferredWindow, objection, urgency, expectationRisk, territoryHint ou userNeighborhood.',
            'Se faltar algum item, mantenha nextState=QUALIFYING, handoff.recommended=false e preencha qualificationMissing.',
            'Se houver pedido explicito de humano, aceitar handoff mesmo com poucos dados, mas preencher handoffSummary com o que ja existe.',
            'handoff deve ser { recommended: boolean, reason: string|null, priority: normal|high }.',
            'risk deve ser { clinicalRisk: boolean, diagnosisRequest: boolean }.',
            'nextSuggestedAction deve ser uma acao curta para recepcao: chamar, mandar pin, explicar avaliacao, sugerir protocolo ou verificar agenda.',
            'technologyContext deve resumir para a equipe a tecnologia relacionada ao objetivo em linguagem operacional, sem ficha tecnica.',
            'technologyMentioned deve dizer se algum aparelho foi citado para a cliente; use "nao citado para cliente" quando ficou so como bastidor.',
            'protocolRationale deve explicar em uma frase por que aquele caminho precisa de avaliacao ou combinacao de tecnologias.',
            'Abertura recomendada: "Oi, seja bem-vinda a Maeve 😊✨ Me conta o que voce quer cuidar hoje?".',
            'O aviso de registro deve aparecer leve e apenas uma vez; nao repita em respostas intermediarias.',
            'Nao pergunte telefone; o WhatsApp ja fornece o numero.',
            'Nao obrigue nome; se a pessoa recusar, siga naturalmente.',
            'Nao faca pergunta explicita de consentimento.',
            'Nao invente preco fechado, agenda, contraindicacao, diagnostico ou promessa de resultado.',
            'Regra de resposta: entregue 1 informacao util, faca 1 pergunta simples e use 1 microconvite quando houver intencao.',
            'Se a pessoa repetir pergunta de catalogo, nao liste tudo de novo; diga que passou o geral e ofereca aprofundar em pele, laser, massagens ou corpo.',
            'Trate objecoes de baixo ticket sem travar: preco, medo de dor, inseguranca, distancia e falta de tempo.',
            'Para preco, entregue valor antes do handoff: explique que depende de objetivo, area e protocolo; diga que a equipe orienta sem compromisso e ve o que faz sentido pra pessoa.',
            'Exemplo para preco: "Entendo 💛 O valor depende da area e do protocolo ideal pra voce. Prefere que a equipe te mostre opcoes mais acessiveis primeiro?".',
            'Quando a pessoa disser dinheiro/preco sem contexto, registre budgetConcern=true e objection=price. Pergunte de leve: "voce tem uma faixa em mente ou prefere que a equipe te mostre opcoes mais acessiveis primeiro?".',
            'Quando a pessoa disser que mora longe, esta sem tempo ou perguntar se compensa ir, registre territoryHint/userNeighborhood quando houver bairro e responda com o endereco validado sem prometer deslocamento.',
            'Exemplo para localizacao: "Ficamos no Jardim Imperial, em Cuiaba ✨ Posso pedir pra equipe te mandar o pin?".',
            'Quando a pessoa mencionar sou negra, pele negra, fototipo ou tom de pele, registre skinToneOrPhototype e acolha: isso importa para escolher com seguranca; pergunte se o interesse e laser, pele ou outro cuidado.',
            'Quando houver drenagem + emagrecer, alinhe expectativa: drenagem pode ajudar com inchaco e sensacao de leveza, mas nao e tratamento de emagrecimento sozinha. Registre expectationRisk.',
            'Se houver sourceCampaign/sourceAd/sourceUrl nos campos atuais, use esse contexto para nao pedir que a pessoa repita o interesse do anuncio.',
            'Para intencao clara de avaliacao/agendamento, recomende handoff cedo e natural.',
            'Exemplo para handoff: "Perfeito, vou deixar tudo encaminhado pra equipe te chamar por aqui 🌿✨".',
            'Varie o convite de handoff: posso deixar encaminhado, quer que eu peca pra equipe te chamar?, posso facilitar isso pra voce?',
            'Em cada resposta: entregue 1 informacao util, faca 1 pergunta simples e, se houver intencao, convide para equipe sem pressao.',
            `Estado atual: ${session?.state ?? 'desconhecido'}`,
            `Campos atuais: ${JSON.stringify(session?.leadDraft ?? {})}`,
            `Historico recente: ${JSON.stringify([...(session?.history ?? []), ...(session?.transientHistory ?? [])].slice(-8))}`,
            `Catalogo: ${catalog.map((item) => item.label).join(', ')}`,
            `Tecnologias Maeve: ${this.formatTechnologiesForPrompt(technologies)}`,
            `Mensagem: ${message}`,
        ].join('\n')

        const response = await withTimeout(
            this.client.models.generateContent({
                model,
                contents: prompt,
                config: {
                    temperature: this.temperature,
                    responseMimeType: 'application/json',
                },
            }),
            this.timeoutMs
        )

        return parseJsonObject(responseText(response))
    }

    formatTechnologiesForPrompt(technologies = []) {
        if (!Array.isArray(technologies) || !technologies.length) return '[]'
        return JSON.stringify(
            technologies.map((technology) => ({
                publicName: technology.publicName,
                internalModel: technology.internalModel,
                brand: technology.brand,
                plainUse: technology.plainUse,
                relatedServices: technology.relatedServices,
                whenToMention: technology.whenToMention,
                avoidClaims: technology.avoidClaims,
                safetyNotes: technology.safetyNotes,
            }))
        )
    }

    normalizeAssessment(payload) {
        return {
            interest: String(payload?.interest ?? 'outro'),
            urgency: String(payload?.urgency ?? 'baixa'),
            objectionTag: String(payload?.objectionTag ?? 'nenhuma'),
            summary: String(payload?.summary ?? 'Resumo nao informado.'),
        }
    }

    normalizeNlu(payload) {
        const decision = this.normalizeConversationDecision(payload)
        return {
            intent: decision.intent,
            slots: decision.slots,
            answer: decision.reply,
            riskFlags: decision.risk,
            handoffRecommended: decision.handoff.recommended,
            nextBestQuestion: null,
            source: decision.source,
            modelUsed: decision.modelUsed,
        }
    }

    normalizeConversationDecision(payload) {
        const handoff = payload?.handoff && typeof payload.handoff === 'object' ? payload.handoff : {}
        const risk = payload?.risk && typeof payload.risk === 'object' ? payload.risk : {}
        const slots = payload?.slots && typeof payload.slots === 'object' ? { ...payload.slots } : {}
        if (payload?.nextSuggestedAction && !slots.nextSuggestedAction) {
            slots.nextSuggestedAction = payload.nextSuggestedAction
        }
        if (payload?.handoffSummary && !slots.handoffSummary) {
            slots.handoffSummary = payload.handoffSummary
        }

        return {
            intent: String(payload?.intent ?? 'general_question'),
            reply: String(payload?.reply ?? payload?.answer ?? ''),
            nextState: String(payload?.nextState ?? 'DISCOVERY'),
            slots,
            handoff: {
                recommended: Boolean(handoff.recommended),
                reason: handoff.reason ? String(handoff.reason) : null,
                priority: handoff.priority ? String(handoff.priority) : 'normal',
            },
            risk: {
                clinicalRisk: Boolean(risk.clinicalRisk),
                diagnosisRequest: Boolean(risk.diagnosisRequest),
            },
            confidence: Number.isFinite(Number(payload?.confidence)) ? Number(payload.confidence) : 0,
            reasoningSummary: String(payload?.reasoningSummary ?? ''),
            source: payload?.source ?? 'gemini',
            modelUsed: payload?.modelUsed ?? null,
        }
    }
}
