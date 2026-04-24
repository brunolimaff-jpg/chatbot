import test from 'node:test'
import assert from 'node:assert/strict'

import { GeminiAiAssistant } from '../../src/infrastructure/ai/gemini-ai-assistant.ts'

test('usa o modelo fallback quando o modelo primario retorna JSON invalido', async () => {
    const calls = []
    const client = {
        models: {
            async generateContent(payload) {
                calls.push(payload.model)
                if (payload.model === 'models/gemini-3.1-flash-lite-preview') {
                    return { text: 'nao-json' }
                }

                return {
                    text: JSON.stringify({
                        interest: 'depilacao_laser',
                        urgency: 'media',
                        objectionTag: 'preco',
                        summary: 'Lead busca depilacao a laser e perguntou sobre valores.',
                    }),
                }
            },
        },
    }

    const assistant = new GeminiAiAssistant({
        client,
        model: 'models/gemini-3.1-flash-lite-preview',
        fallbackModel: 'gemini-2.5-pro',
        timeoutMs: 1000,
    })

    const result = await assistant.assessText('Quero depilacao a laser, quanto custa?')

    assert.deepEqual(calls, ['models/gemini-3.1-flash-lite-preview', 'gemini-2.5-pro'])
    assert.equal(result.interest, 'depilacao_laser')
    assert.equal(result.objectionTag, 'preco')
})

test('cai para heuristica local quando Gemini falha nos dois modelos', async () => {
    const client = {
        models: {
            async generateContent() {
                throw new Error('api unavailable')
            },
        },
    }

    const assistant = new GeminiAiAssistant({
        client,
        model: 'models/gemini-3.1-flash-lite-preview',
        fallbackModel: 'gemini-2.5-pro',
        timeoutMs: 1000,
    })

    const result = await assistant.assessText('Tenho interesse em limpeza de pele')

    assert.equal(result.interest, 'limpeza_pele')
    assert.match(result.summary, /Interesse inferido/)
})

test('prompt conversacional orienta tom de amiga consultiva e conversao leve', async () => {
    let prompt = ''
    const client = {
        models: {
            async generateContent(payload) {
                prompt = payload.contents
                return {
                    text: JSON.stringify({
                        intent: 'greeting',
                        reply: 'Oi, seja bem-vinda a Maeve. Me conta o que voce quer cuidar hoje?',
                        nextState: 'DISCOVERY',
                        slots: {},
                        handoff: { recommended: false, reason: null, priority: 'normal' },
                        risk: { clinicalRisk: false, diagnosisRequest: false },
                        confidence: 0.9,
                        reasoningSummary: 'Abertura leve.',
                    }),
                }
            },
        },
    }

    const assistant = new GeminiAiAssistant({
        client,
        model: 'models/gemini-3.1-flash-lite-preview',
        fallbackModel: 'gemini-2.5-pro',
        timeoutMs: 1000,
    })

    await assistant.planConversationTurn({
        message: 'alo',
        session: { state: 'DISCOVERY', leadDraft: {}, history: [], transientHistory: [] },
        catalog: [],
    })

    assert.match(prompt, /consultora amiga da Maeve/i)
    assert.match(prompt, /amiga consultiva/i)
    assert.match(prompt, /ticket acessivel/i)
    assert.match(prompt, /alta conversao/i)
    assert.match(prompt, /gerar mais agendamentos/i)
    assert.match(prompt, /avaliacao leve/i)
    assert.match(prompt, /bem-vinda/i)
    assert.match(prompt, /me conta/i)
    assert.doesNotMatch(prompt, /maximo 1 emoji/i)
    assert.match(prompt, /1-2 emojis/i)
    assert.match(prompt, /ate 3/i)
    for (const emoji of ['😊', '✨', '🌿', '💛', '✅', '⚠️', '⏰', '🤍', '💬', '🙌', '🌸', '🫶', '🔎', '📍', '📌', '🗓️', '💡', '🤝']) {
        assert.match(prompt, new RegExp(emoji))
    }
    assert.match(prompt, /varie os emojis/i)
    assert.match(prompt, /nao repita o mesmo emoji/i)
    assert.match(prompt, /nao use estereotipos/i)
    assert.match(prompt, /nao soe como anuncio/i)
})

test('prompt posiciona Maeve como melhor escolha sem ranking falso', async () => {
    let prompt = ''
    const client = {
        models: {
            async generateContent(payload) {
                prompt = payload.contents
                return {
                    text: JSON.stringify({
                        intent: 'general_question',
                        reply: 'A Maeve e a melhor escolha quando voce quer avaliacao cuidadosa e protocolo pensado para voce.',
                        nextState: 'DISCOVERY',
                        slots: {},
                        handoff: { recommended: false, reason: null, priority: 'normal' },
                        risk: { clinicalRisk: false, diagnosisRequest: false },
                        confidence: 0.9,
                        reasoningSummary: 'Posicionamento comercial com cuidado.',
                    }),
                }
            },
        },
    }

    const assistant = new GeminiAiAssistant({
        client,
        model: 'models/gemini-3.1-flash-lite-preview',
        fallbackModel: 'gemini-2.5-pro',
        timeoutMs: 1000,
    })

    await assistant.planConversationTurn({
        message: 'eles sao os melhores do mercado?',
        session: { state: 'DISCOVERY', leadDraft: {}, history: [], transientHistory: [] },
        catalog: [],
    })

    assert.match(prompt, /Maeve e a melhor escolha/i)
    assert.match(prompt, /defenda a Maeve com seguranca/i)
    assert.match(prompt, /sem ranking falso/i)
    assert.match(prompt, /sem diminuir concorrentes/i)
    assert.match(prompt, /avaliacao personalizada/i)
})

test('prompt inclui exemplos Maeve com emoji equilibrado por momento', async () => {
    let prompt = ''
    const client = {
        models: {
            async generateContent(payload) {
                prompt = payload.contents
                return {
                    text: JSON.stringify({
                        intent: 'schedule_interest',
                        reply: 'Perfeito, vou deixar tudo encaminhado pra equipe te chamar por aqui 🌿✨',
                        nextState: 'READY_FOR_HANDOFF',
                        slots: {
                            objective: 'avaliacao personalizada',
                            handoffSummary: 'Lead pediu avaliacao.',
                            nextSuggestedAction: 'chamar pelo WhatsApp',
                        },
                        handoff: { recommended: true, reason: 'avaliacao_solicitada', priority: 'normal' },
                        risk: { clinicalRisk: false, diagnosisRequest: false },
                        confidence: 0.9,
                        reasoningSummary: 'Handoff com tom Maeve.',
                    }),
                }
            },
        },
    }

    const assistant = new GeminiAiAssistant({
        client,
        model: 'models/gemini-3.1-flash-lite-preview',
        fallbackModel: 'gemini-2.5-pro',
        timeoutMs: 1000,
    })

    await assistant.planConversationTurn({
        message: 'quero fazer avaliacao',
        session: { state: 'DISCOVERY', leadDraft: {}, history: [], transientHistory: [] },
        catalog: [],
    })

    assert.match(prompt, /Oi, seja bem-vinda a Maeve 😊✨/)
    assert.match(prompt, /Entendo 💛 O valor depende/)
    assert.match(prompt, /Ficamos no Jardim Imperial, em Cuiaba ✨/)
    assert.match(prompt, /Perfeito, vou deixar tudo encaminhado.*🌿✨/)
    assert.match(prompt, /Alertas clinicos, preco, LGPD e risco.*moderacao/i)
    assert.match(prompt, /nunca use emoji para suavizar risco serio/i)
})

test('prompt orienta qualificacao minima e slots consultivos antes do handoff', async () => {
    let prompt = ''
    const client = {
        models: {
            async generateContent(payload) {
                prompt = payload.contents
                return {
                    text: JSON.stringify({
                        intent: 'general_question',
                        reply: 'Me conta mais um detalhe pra eu te orientar melhor.',
                        nextState: 'QUALIFYING',
                        slots: {},
                        handoff: { recommended: false, reason: null, priority: 'normal' },
                        risk: { clinicalRisk: false, diagnosisRequest: false },
                        confidence: 0.9,
                        reasoningSummary: 'Qualificar antes do handoff.',
                    }),
                }
            },
        },
    }

    const assistant = new GeminiAiAssistant({
        client,
        model: 'models/gemini-3.1-flash-lite-preview',
        fallbackModel: 'gemini-2.5-pro',
        timeoutMs: 1000,
    })

    await assistant.planConversationTurn({
        message: 'dinheiro',
        session: { state: 'DISCOVERY', leadDraft: {}, history: [], transientHistory: [] },
        catalog: [],
    })

    assert.match(prompt, /objetivo \+ servico\/interesse \+ 1 detalhe util/i)
    assert.match(prompt, /skinToneOrPhototype/)
    assert.match(prompt, /budgetConcern/)
    assert.match(prompt, /budgetPreference/)
    assert.match(prompt, /expectationRisk/)
    assert.match(prompt, /territoryHint/)
    assert.match(prompt, /sourceCampaign/)
    assert.match(prompt, /nextSuggestedAction/)
    assert.match(prompt, /qualificationMissing/)
    assert.match(prompt, /drenagem.*emagrecer/i)
    assert.match(prompt, /sou negra|fototipo/i)
})

test('prompt inclui tecnologias Maeve como repertorio consultivo interno', async () => {
    let prompt = ''
    const client = {
        models: {
            async generateContent(payload) {
                prompt = payload.contents
                return {
                    text: JSON.stringify({
                        intent: 'service_question',
                        reply: 'Sim, a Maeve trabalha com protocolos corporais. Me conta qual area te incomoda mais?',
                        nextState: 'QUALIFYING',
                        slots: {
                            objective: 'gordura localizada',
                            service: 'protocolo_personalizado_maeve',
                            technologyContext: 'protocolo corporal com criolipolise, radiofrequencia e ultrassom',
                            protocolRationale: 'avaliar regiao e objetivo antes de indicar tecnologia',
                        },
                        handoff: { recommended: false, reason: null, priority: 'normal' },
                        risk: { clinicalRisk: false, diagnosisRequest: false },
                        confidence: 0.9,
                        reasoningSummary: 'Usou tecnologias como repertorio interno.',
                    }),
                }
            },
        },
    }

    const assistant = new GeminiAiAssistant({
        client,
        model: 'models/gemini-3.1-flash-lite-preview',
        fallbackModel: 'gemini-2.5-pro',
        timeoutMs: 1000,
    })

    await assistant.planConversationTurn({
        message: 'voces tratam gordura localizada?',
        session: { state: 'DISCOVERY', leadDraft: {}, history: [], transientHistory: [] },
        catalog: [
            {
                id: 'protocolo_personalizado_maeve',
                label: 'Protocolo Personalizado Maeve',
                aliases: ['gordura localizada'],
                technologies: [
                    {
                        publicName: 'Criodermis Smart',
                        plainUse: 'apoio em protocolos corporais para gordura localizada',
                    },
                ],
            },
        ],
        technologies: [
            {
                publicName: 'Criodermis Smart',
                internalModel: 'Criodermis Smart Medical San',
                brand: 'Medical San',
                plainUse: 'apoio em protocolos corporais para gordura localizada',
                relatedServices: ['protocolo_personalizado_maeve'],
                whenToMention: 'cite apenas quando perguntarem por aparelho ou quando passar confianca sem tecnicismo',
                avoidClaims: ['resultado garantido'],
                safetyNotes: ['indicar avaliacao antes do protocolo'],
            },
        ],
    })

    assert.match(prompt, /Tecnologias Maeve/i)
    assert.match(prompt, /repertorio consultivo/i)
    assert.match(prompt, /nao como lista tecnica/i)
    assert.match(prompt, /linguagem de beneficio percebido/i)
    assert.match(prompt, /nao cite parametros tecnicos sem pedido explicito/i)
    assert.match(prompt, /technologyContext/)
    assert.match(prompt, /technologyMentioned/)
    assert.match(prompt, /protocolRationale/)
    assert.match(prompt, /Criodermis Smart/)
    assert.match(prompt, /resultado garantido/i)
})

test('prompt orienta localizacao real e nao inventar rota ou estacionamento', async () => {
    let prompt = ''
    const client = {
        models: {
            async generateContent(payload) {
                prompt = payload.contents
                return {
                    text: JSON.stringify({
                        intent: 'location_question',
                        reply: 'A Maeve fica no Jardim Imperial, em Cuiaba. Posso pedir pra equipe te mandar o pin?',
                        nextState: 'DISCOVERY',
                        slots: { territoryHint: 'Jardim Imperial, Cuiaba' },
                        handoff: { recommended: false, reason: null, priority: 'normal' },
                        risk: { clinicalRisk: false, diagnosisRequest: false },
                        confidence: 0.9,
                        reasoningSummary: 'Resposta de localizacao.',
                    }),
                }
            },
        },
    }

    const assistant = new GeminiAiAssistant({
        client,
        model: 'models/gemini-3.1-flash-lite-preview',
        fallbackModel: 'gemini-2.5-pro',
        timeoutMs: 1000,
    })

    await assistant.planConversationTurn({
        message: 'onde fica?',
        session: { state: 'DISCOVERY', leadDraft: {}, history: [], transientHistory: [] },
        catalog: [],
    })

    assert.match(prompt, /Avenida das Palmeiras, 17/i)
    assert.match(prompt, /Jardim Imperial/i)
    assert.match(prompt, /mandar o pin/i)
    assert.match(prompt, /Nao invente rota, estacionamento, tempo de deslocamento/i)
})
