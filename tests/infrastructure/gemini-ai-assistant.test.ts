import test from 'node:test'
import assert from 'node:assert/strict'

import { GeminiAiAssistant } from '../../src/infrastructure/ai/gemini-ai-assistant.ts'

const createPromptClient = (response = {}) => {
    const state = { prompt: '', calls: [] }
    const client = {
        models: {
            async generateContent(payload) {
                state.calls.push(payload.model)
                state.prompt = payload.contents
                return {
                    text: JSON.stringify({
                        intent: 'general_question',
                        reply: 'Resposta da Maêve.',
                        nextState: 'DISCOVERY',
                        slots: {},
                        handoff: { recommended: false, reason: null, priority: 'normal' },
                        risk: { clinicalRisk: false, diagnosisRequest: false },
                        confidence: 0.9,
                        reasoningSummary: 'Resposta válida.',
                        ...response,
                    }),
                }
            },
        },
    }
    return { client, state }
}

const createAssistant = (client) =>
    new GeminiAiAssistant({
        client,
        model: 'models/gemini-3.1-flash-lite-preview',
        fallbackModel: 'gemini-2.5-pro',
        timeoutMs: 1000,
    })

const runTurn = async (assistant, input = {}) =>
    assistant.planConversationTurn({
        message: input.message ?? 'olá',
        session: input.session ?? { state: 'DISCOVERY', leadDraft: {}, history: [], transientHistory: [] },
        catalog: input.catalog ?? [],
        technologies: input.technologies ?? [],
    })

test('usa o modelo fallback quando o modelo primário retorna JSON inválido', async () => {
    const calls = []
    const client = {
        models: {
            async generateContent(payload) {
                calls.push(payload.model)
                if (payload.model === 'models/gemini-3.1-flash-lite-preview') return { text: 'nao-json' }
                return {
                    text: JSON.stringify({
                        interest: 'depilacao_laser',
                        urgency: 'media',
                        objectionTag: 'preco',
                        summary: 'Lead busca depilação a laser e perguntou sobre valores.',
                    }),
                }
            },
        },
    }

    const result = await createAssistant(client).assessText('Quero depilação a laser, quanto custa?')

    assert.deepEqual(calls, ['models/gemini-3.1-flash-lite-preview', 'gemini-2.5-pro'])
    assert.equal(result.interest, 'depilacao_laser')
    assert.equal(result.objectionTag, 'preco')
})

test('cai para heurística local quando Gemini falha nos dois modelos', async () => {
    const client = { models: { async generateContent() { throw new Error('api unavailable') } } }
    const result = await createAssistant(client).assessText('Tenho interesse em limpeza de pele')

    assert.equal(result.interest, 'limpeza_pele')
    assert.match(result.summary, /Interesse inferido/)
})

test('prompt conversacional orienta tom de amiga consultiva e conversão leve', async () => {
    const { client, state } = createPromptClient({ intent: 'greeting' })
    await runTurn(createAssistant(client), { message: 'alô' })

    assert.match(state.prompt, /consultora amiga da Maêve/i)
    assert.match(state.prompt, /amiga consultiva/i)
    assert.match(state.prompt, /ticket acessível/i)
    assert.match(state.prompt, /alta conversão/i)
    assert.match(state.prompt, /gerar mais agendamentos/i)
    assert.match(state.prompt, /avaliação leve/i)
    assert.match(state.prompt, /bem-vinda/i)
    assert.match(state.prompt, /me conta/i)
    assert.match(state.prompt, /1-2 emojis/i)
    assert.match(state.prompt, /até 3/i)
    for (const emoji of ['😊', '✨', '🌿', '💛', '✅', '⚠️', '⏰', '🤍', '💬', '🙌', '🌸', '🫶', '🔎', '📍', '📌', '🗓️', '💡', '🤝']) {
        assert.match(state.prompt, new RegExp(emoji))
    }
    assert.match(state.prompt, /varie os emojis/i)
    assert.match(state.prompt, /não repita o mesmo emoji/i)
    assert.match(state.prompt, /não use estereótipos/i)
    assert.match(state.prompt, /não soe como anúncio/i)
})

test('prompt posiciona Maêve como melhor escolha sem ranking falso', async () => {
    const { client, state } = createPromptClient()
    await runTurn(createAssistant(client), { message: 'eles são os melhores do mercado?' })

    assert.match(state.prompt, /Maêve é a melhor escolha/i)
    assert.match(state.prompt, /defenda a Maêve com segurança/i)
    assert.match(state.prompt, /sem ranking falso/i)
    assert.match(state.prompt, /sem diminuir concorrentes/i)
    assert.match(state.prompt, /avaliação personalizada/i)
})

test('prompt inclui exemplos Maêve com emoji equilibrado por momento', async () => {
    const { client, state } = createPromptClient({ intent: 'schedule_interest' })
    await runTurn(createAssistant(client), { message: 'quero fazer avaliação' })

    assert.match(state.prompt, /Oi, seja bem-vinda à Maêve 😊✨/)
    assert.match(state.prompt, /Entendo 💛 O valor depende/)
    assert.match(state.prompt, /Ficamos no Jardim Imperial, em Cuiabá ✨/)
    assert.match(state.prompt, /Perfeito, vou deixar tudo encaminhado.*🌿✨/)
    assert.match(state.prompt, /Alertas clínicos, preço, LGPD e risco.*moderação/i)
    assert.match(state.prompt, /nunca use emoji para suavizar risco sério/i)
})

test('prompt orienta qualificação mínima e slots consultivos antes do handoff', async () => {
    const { client, state } = createPromptClient()
    await runTurn(createAssistant(client), { message: 'dinheiro' })

    assert.match(state.prompt, /objetivo \+ serviço\/interesse \+ 1 detalhe útil/i)
    assert.match(state.prompt, /skinToneOrPhototype/)
    assert.match(state.prompt, /budgetConcern/)
    assert.match(state.prompt, /budgetPreference/)
    assert.match(state.prompt, /expectationRisk/)
    assert.match(state.prompt, /territoryHint/)
    assert.match(state.prompt, /sourceCampaign/)
    assert.match(state.prompt, /nextSuggestedAction/)
    assert.match(state.prompt, /qualificationMissing/)
    assert.match(state.prompt, /drenagem.*emagrecer/i)
    assert.match(state.prompt, /sou negra|fototipo/i)
})

test('prompt inclui tecnologias Maêve como repertório consultivo interno', async () => {
    const { client, state } = createPromptClient({ intent: 'service_question' })
    await runTurn(createAssistant(client), {
        message: 'vocês tratam gordura localizada?',
        catalog: [{ id: 'protocolo_personalizado_maeve', label: 'Protocolo Personalizado Maêve', aliases: ['gordura localizada'] }],
        technologies: [{
            publicName: 'Criodermis Smart',
            internalModel: 'Criodermis Smart Medical San',
            brand: 'Medical San',
            plainUse: 'apoio em protocolos corporais para gordura localizada',
            relatedServices: ['protocolo_personalizado_maeve'],
            whenToMention: 'cite apenas quando perguntarem por aparelho ou quando passar confiança sem tecnicismo',
            avoidClaims: ['resultado garantido'],
            safetyNotes: ['indicar avaliação antes do protocolo'],
        }],
    })

    assert.match(state.prompt, /Tecnologias Maêve/i)
    assert.match(state.prompt, /repertório consultivo/i)
    assert.match(state.prompt, /não.*lista técnica/i)
    assert.match(state.prompt, /linguagem de benefício percebido/i)
    assert.match(state.prompt, /Não cite parâmetros técnicos sem pedido explícito/i)
    assert.match(state.prompt, /technologyContext/)
    assert.match(state.prompt, /technologyMentioned/)
    assert.match(state.prompt, /protocolRationale/)
    assert.match(state.prompt, /Criodermis Smart/)
    assert.match(state.prompt, /resultado garantido/i)
})

test('prompt orienta localização real e não inventar rota ou estacionamento', async () => {
    const { client, state } = createPromptClient({ intent: 'location_question' })
    await runTurn(createAssistant(client), { message: 'onde fica?' })

    assert.match(state.prompt, /Avenida das Palmeiras, 17/i)
    assert.match(state.prompt, /Jardim Imperial/i)
    assert.match(state.prompt, /mandar o pin/i)
    assert.match(state.prompt, /Não invente rota, estacionamento, tempo de deslocamento/i)
})
