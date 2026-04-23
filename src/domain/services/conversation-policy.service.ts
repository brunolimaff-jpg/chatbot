import { CONVERSATION_STATE } from '../entities/conversation-session.ts'
import { normalizeObjection, normalizeUrgency } from '../entities/scorecard.ts'
import { normalizeForMatch } from '../../shared/text-normalizer.ts'

const YES_TERMS = ['sim', 'claro', 'ok', 'pode', 'aceito', 'autorizo']
const NO_TERMS = ['nao', 'negativo', 'prefiro nao', 'recuso', 'encerrar', 'sair']
const RESTART_TERMS = ['agendar', 'reiniciar', 'recomecar', 'novo atendimento', 'menu']
const EXIT_TERMS = ['encerrar', 'sair', 'parar', 'cancelar']

const includesAny = (normalized, terms) => terms.some((term) => normalized.includes(term))

export class ConversationPolicyService {
    constructor({ maxInvalidAttempts = 2 } = {}) {
        this.maxInvalidAttempts = maxInvalidAttempts
    }

    parseYesNo(value = '') {
        const normalized = normalizeForMatch(value)
        if (!normalized) return null
        if (includesAny(normalized, YES_TERMS)) return true
        if (includesAny(normalized, NO_TERMS)) return false
        return null
    }

    isRestartCommand(value = '') {
        return includesAny(normalizeForMatch(value), RESTART_TERMS)
    }

    isExitCommand(value = '') {
        return includesAny(normalizeForMatch(value), EXIT_TERMS)
    }

    isMaxInvalidAttemptsReached(attempts = 0) {
        return attempts > this.maxInvalidAttempts
    }

    validateForState(state, input = '') {
        const text = String(input ?? '').trim()

        if (!text) return { valid: false, error: 'Resposta vazia.' }
        if (this.isYesNoState(state)) return this.validateYesNo(text)
        if (state === CONVERSATION_STATE.NAME) return this.validateName(text)
        if (state === CONVERSATION_STATE.OBJECTIVE) return this.validateObjective(text)
        if (state === CONVERSATION_STATE.SCORECARD_URGENCY) return this.validateUrgency(text)
        if (state === CONVERSATION_STATE.SCORECARD_OBJECTION) return this.validateObjection(text)
        if (state === CONVERSATION_STATE.PREFERRED_WINDOW) return this.validatePreferredWindow(text)
        return { valid: true, value: text }
    }

    isYesNoState(state) {
        return (
            state === CONVERSATION_STATE.INTENT_CONFIRM ||
            state === CONVERSATION_STATE.LGPD_CONSENT ||
            state === CONVERSATION_STATE.SUMMARY_CONFIRM
        )
    }

    validateYesNo(text) {
        const answer = this.parseYesNo(text)
        return {
            valid: answer !== null,
            value: answer,
            error: 'Responda apenas com sim ou nao.',
        }
    }

    validateName(text) {
        return {
            valid: text.length >= 2,
            value: text,
            error: 'Informe seu nome para continuar.',
        }
    }

    validateObjective(text) {
        return {
            valid: text.length >= 4,
            value: text,
            error: 'Descreva rapidamente o resultado estetico que voce busca.',
        }
    }

    validateUrgency(text) {
        const urgency = normalizeUrgency(text)
        return {
            valid: Boolean(urgency),
            value: urgency,
            error: 'Diga para quando voce gostaria de ser atendido(a).',
        }
    }

    validateObjection(text) {
        const objection = normalizeObjection(text)
        return {
            valid: Boolean(objection),
            value: objection,
            error: 'Informe a principal preocupacao: preco, dor, recuperacao, seguranca ou outro.',
        }
    }

    validatePreferredWindow(text) {
        return {
            valid: text.length >= 3,
            value: text,
            error: 'Informe um periodo ou horario preferido.',
        }
    }
}
