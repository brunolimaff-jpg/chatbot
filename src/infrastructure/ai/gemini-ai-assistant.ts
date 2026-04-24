import { GoogleGenAI } from '@google/genai'
import { buildGeminiConversationPrompt } from './gemini-conversation-prompt.ts'
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

const withTimeout = async (promise, timeoutMs) => {
    let timeoutId
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Gemini request timed out')), timeoutMs)
    })

    try {
        return await Promise.race([promise, timeout])
    } finally {
        clearTimeout(timeoutId)
    }
}

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
            'Você classifica leads da Maêve Estética Avançada em Cuiabá.',
            'Responda somente JSON válido com as chaves: interest, urgency, objectionTag, summary.',
            'interest deve ser um de: avaliacao_geral, limpeza_pele, depilacao_laser, drenagem_linfatica, massagem_modeladora, massagem_relaxante, massagem_pos_operatoria, dermaplaning, outro.',
            'urgency deve ser: alta, média ou baixa.',
            'objectionTag deve ser: preco, dor, recuperacao, seguranca, nenhuma ou outro.',
            `Mensagem: ${text}`,
        ].join('\n')

        const response = await this.generateJson(model, prompt)
        return parseJsonObject(responseText(response))
    }

    async understandWithModel(model, { message, session, catalog, technologies = [] }) {
        return this.planWithModel(model, { message, session, catalog, technologies })
    }

    async planWithModel(model, { message, session, catalog, technologies = [] }) {
        const prompt = buildGeminiConversationPrompt({ message, session, catalog, technologies })
        const response = await this.generateJson(model, prompt)
        return parseJsonObject(responseText(response))
    }

    async generateJson(model, prompt) {
        return withTimeout(
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
    }

    normalizeAssessment(payload) {
        return {
            interest: String(payload?.interest ?? 'outro'),
            urgency: String(payload?.urgency ?? 'baixa'),
            objectionTag: String(payload?.objectionTag ?? 'nenhuma'),
            summary: String(payload?.summary ?? 'Resumo não informado.'),
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
        if (payload?.nextSuggestedAction && !slots.nextSuggestedAction) slots.nextSuggestedAction = payload.nextSuggestedAction
        if (payload?.handoffSummary && !slots.handoffSummary) slots.handoffSummary = payload.handoffSummary

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
