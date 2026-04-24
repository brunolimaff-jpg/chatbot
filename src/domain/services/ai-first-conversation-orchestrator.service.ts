import { CONVERSATION_STATE } from '../entities/conversation-session.ts'

const HUMAN_RISK_REPLY =
    'Por segurança, não consigo orientar diagnóstico ou conduta clínica por aqui. Vou encaminhar para atendimento humano te acompanhar com prioridade.'

const PRIVACY_NOTICE_REPLY =
    'Oi, seja bem-vinda à Maêve 😊✨ Me conta o que você quer cuidar ou melhorar hoje?'

const allowedStates = new Set([
    CONVERSATION_STATE.DISCOVERY,
    CONVERSATION_STATE.QUALIFYING,
    CONVERSATION_STATE.READY_FOR_HANDOFF,
    CONVERSATION_STATE.CLOSED,
])

export class AiFirstConversationOrchestratorService {
    constructor({ aiAssistant, catalogService, safetyGuardService }) {
        this.aiAssistant = aiAssistant
        this.catalogService = catalogService
        this.safetyGuardService = safetyGuardService
    }

    async analyze({ message, session }) {
        const risk = this.safetyGuardService.evaluateText(message)
        if (risk.highRisk || risk.diagnosisRequest) {
            return this.normalizeDecision({
                intent: 'clinical_risk',
                reply: HUMAN_RISK_REPLY,
                nextState: CONVERSATION_STATE.CLOSED,
                handoff: {
                    recommended: true,
                    reason: risk.recommendedAction,
                    priority: 'high',
                },
                risk: {
                    clinicalRisk: risk.highRisk,
                    diagnosisRequest: risk.diagnosisRequest,
                    matchedKeywords: risk.matchedKeywords,
                },
                confidence: 1,
                reasoningSummary: 'Guardrail clínico determinístico acionado antes da IA.',
                source: 'guardrail',
                modelUsed: null,
            })
        }

        try {
            const decision = await this.aiAssistant.planConversationTurn({
                message,
                session,
                catalog: this.catalogService.listServices(),
                technologies: this.catalogService.listTechnologies(),
            })
            return this.normalizeDecision(decision)
        } catch {
            return this.fallbackDecision(message)
        }
    }

    fallbackDecision(message) {
        const text = String(message ?? '').trim()
        return this.normalizeDecision({
            intent: 'fallback',
            reply: PRIVACY_NOTICE_REPLY,
            nextState: CONVERSATION_STATE.DISCOVERY,
            slots: text ? { objective: text } : {},
            handoff: { recommended: false, reason: null, priority: 'normal' },
            risk: { clinicalRisk: false, diagnosisRequest: false },
            confidence: 0,
            reasoningSummary: 'Fallback seguro usado porque a IA não retornou uma decisão válida.',
            source: 'fallback',
            modelUsed: null,
        })
    }

    normalizeDecision(payload = {}) {
        const handoff = payload.handoff && typeof payload.handoff === 'object' ? payload.handoff : {}
        const risk = payload.risk && typeof payload.risk === 'object' ? payload.risk : {}
        const nextState = allowedStates.has(payload.nextState) ? payload.nextState : CONVERSATION_STATE.DISCOVERY
        const slots = payload.slots && typeof payload.slots === 'object' ? { ...payload.slots } : {}
        if (payload.nextSuggestedAction && !slots.nextSuggestedAction) {
            slots.nextSuggestedAction = payload.nextSuggestedAction
        }
        if (payload.handoffSummary && !slots.handoffSummary) {
            slots.handoffSummary = payload.handoffSummary
        }

        return {
            intent: String(payload.intent ?? 'general_question'),
            reply: this.sanitizeReply(payload.reply),
            nextState,
            slots,
            handoff: {
                recommended: Boolean(handoff.recommended),
                reason: handoff.reason ? String(handoff.reason) : null,
                priority: handoff.priority ? String(handoff.priority) : 'normal',
            },
            risk: {
                clinicalRisk: Boolean(risk.clinicalRisk),
                diagnosisRequest: Boolean(risk.diagnosisRequest),
                matchedKeywords: Array.isArray(risk.matchedKeywords) ? risk.matchedKeywords : [],
            },
            confidence: Number.isFinite(Number(payload.confidence)) ? Number(payload.confidence) : 0,
            reasoningSummary: String(payload.reasoningSummary ?? 'Decisão sem resumo.'),
            source: payload.source ?? 'gemini',
            modelUsed: payload.modelUsed ?? null,
        }
    }

    isQualificationComplete(draft = {}) {
        return Boolean(draft.objective && draft.service && this.hasUsefulDetail(draft))
    }

    hasUsefulDetail(draft = {}) {
        return Boolean(
            draft.bodyArea ||
                draft.skinToneOrPhototype ||
                draft.budgetConcern ||
                draft.budgetPreference ||
                draft.preferredWindow ||
                draft.objection ||
                draft.urgency ||
                draft.expectationRisk ||
                draft.territoryHint ||
                draft.userNeighborhood
        )
    }

    sanitizeReply(reply) {
        const text = String(reply ?? '').trim()
        if (!text) return PRIVACY_NOTICE_REPLY

        if (/R\$\s*\d/i.test(text)) {
            return [
                'Entendo 💛 O valor depende do objetivo, da área e do protocolo que fizer sentido para você.',
                'A equipe te orienta sem compromisso e vê o que faz sentido para você, sem te passar uma tabela fria.',
            ].join(' ')
        }

        return text.replace(/\bMaeve\b/g, 'Maêve')
    }
}
