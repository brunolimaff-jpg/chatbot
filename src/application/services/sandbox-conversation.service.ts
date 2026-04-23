import {
    CONVERSATION_STATE,
    registerInvalidAttempt,
    updateSessionState,
} from '../../domain/entities/conversation-session.ts'
import { sanitizeText } from '../../domain/entities/lead.ts'
import { buildSummaryMessage, conversationCopy, leadTemperatureMessage } from './conversation-copy.ts'

export class SandboxConversationService {
    constructor(dependencies) {
        this.startConversationUseCase = dependencies.startConversationUseCase
        this.captureLeadFieldUseCase = dependencies.captureLeadFieldUseCase
        this.qualifyLeadUseCase = dependencies.qualifyLeadUseCase
        this.dispatchHandoffUseCase = dependencies.dispatchHandoffUseCase
        this.evaluateRiskUseCase = dependencies.evaluateRiskUseCase
        this.sessionRepository = dependencies.sessionRepository
        this.policyService = dependencies.policyService
    }

    async handleMessage(input) {
        const from = sanitizeText(input?.from)
        const message = sanitizeText(input?.message)
        if (!from || !message) throw new Error('from and message are required')

        if (this.policyService.isRestartCommand(message)) {
            await this.reset({ from })
        }

        const { session } = await this.startConversationUseCase.execute({ phoneNumber: from })
        if (session.state === CONVERSATION_STATE.ENTRY) {
            return this.moveToIntentConfirm(session)
        }

        if (this.policyService.isExitCommand(message)) {
            return this.closeSession(session, [conversationCopy.close])
        }

        return this.routeByState(session, message)
    }

    async reset(input) {
        if (input?.from) {
            await this.sessionRepository.deleteByPhone(input.from)
            return
        }

        if (input?.sessionId) {
            await this.sessionRepository.deleteById(input.sessionId)
            return
        }

        throw new Error('from or sessionId is required')
    }

    async getSession(input) {
        if (input?.from) {
            return this.sessionRepository.findByPhone(input.from)
        }

        if (input?.sessionId) {
            return this.sessionRepository.findById(input.sessionId)
        }

        throw new Error('from or sessionId is required')
    }

    async moveToIntentConfirm(session) {
        const updated = updateSessionState(session, CONVERSATION_STATE.INTENT_CONFIRM)
        await this.sessionRepository.save(updated)
        return { session: updated, messages: [conversationCopy.askContinue] }
    }

    routeByState(session, message) {
        if (session.state === CONVERSATION_STATE.INTENT_CONFIRM) return this.handleIntent(session, message)
        if (session.state === CONVERSATION_STATE.NAME) return this.handleName(session, message)
        if (session.state === CONVERSATION_STATE.OBJECTIVE) return this.handleObjective(session, message)
        if (session.state === CONVERSATION_STATE.SCORECARD_URGENCY) return this.handleUrgency(session, message)
        if (session.state === CONVERSATION_STATE.SCORECARD_OBJECTION) return this.handleObjection(session, message)
        if (session.state === CONVERSATION_STATE.PREFERRED_WINDOW) return this.handleWindow(session, message)
        if (session.state === CONVERSATION_STATE.LGPD_CONSENT) return this.handleConsent(session, message)
        if (session.state === CONVERSATION_STATE.SUMMARY_CONFIRM) return this.handleSummaryConfirm(session, message)
        return this.moveToIntentConfirm(session)
    }

    async handleIntent(session, message) {
        const validation = this.policyService.validateForState(CONVERSATION_STATE.INTENT_CONFIRM, message)
        if (!validation.valid) return this.invalid(session, validation.error, message)
        if (validation.value === false) return this.closeSession(session, [conversationCopy.close])
        return this.capture(session, { nextState: CONVERSATION_STATE.NAME }, conversationCopy.askName)
    }

    async handleName(session, message) {
        const validation = this.policyService.validateForState(CONVERSATION_STATE.NAME, message)
        if (!validation.valid) return this.invalid(session, validation.error, message)
        return this.capture(session, { name: validation.value, nextState: CONVERSATION_STATE.OBJECTIVE }, conversationCopy.askObjective)
    }

    async handleObjective(session, message) {
        const validation = this.policyService.validateForState(CONVERSATION_STATE.OBJECTIVE, message)
        if (!validation.valid) return this.invalid(session, validation.error, message)

        const risk = await this.evaluateRiskUseCase.execute({ text: validation.value })
        if (risk.highRisk || risk.diagnosisRequest) {
            return this.forwardToHuman(session, validation.value, risk.recommendedAction)
        }

        return this.capture(
            session,
            { objective: validation.value, nextState: CONVERSATION_STATE.SCORECARD_URGENCY },
            conversationCopy.askUrgency
        )
    }

    async handleUrgency(session, message) {
        const validation = this.policyService.validateForState(CONVERSATION_STATE.SCORECARD_URGENCY, message)
        if (!validation.valid) return this.invalid(session, validation.error, message)
        return this.capture(
            session,
            { urgency: validation.value, nextState: CONVERSATION_STATE.SCORECARD_OBJECTION },
            conversationCopy.askObjection
        )
    }

    async handleObjection(session, message) {
        const validation = this.policyService.validateForState(CONVERSATION_STATE.SCORECARD_OBJECTION, message)
        if (!validation.valid) return this.invalid(session, validation.error, message)
        return this.capture(
            session,
            { objection: validation.value, nextState: CONVERSATION_STATE.PREFERRED_WINDOW },
            conversationCopy.askWindow
        )
    }

    async handleWindow(session, message) {
        const validation = this.policyService.validateForState(CONVERSATION_STATE.PREFERRED_WINDOW, message)
        if (!validation.valid) return this.invalid(session, validation.error, message)
        return this.capture(session, { preferredWindow: validation.value, nextState: CONVERSATION_STATE.LGPD_CONSENT }, conversationCopy.askConsent)
    }

    async handleConsent(session, message) {
        const validation = this.policyService.validateForState(CONVERSATION_STATE.LGPD_CONSENT, message)
        if (!validation.valid) return this.invalid(session, validation.error, message)
        if (validation.value === false) return this.closeSession(session, [conversationCopy.consentRequired])
        const captured = await this.capture(session, { consent: true, nextState: CONVERSATION_STATE.SUMMARY_CONFIRM }, null)
        return {
            session: captured.session,
            messages: [buildSummaryMessage(captured.session.leadDraft), conversationCopy.askSummaryConfirm],
        }
    }

    async handleSummaryConfirm(session, message) {
        const validation = this.policyService.validateForState(CONVERSATION_STATE.SUMMARY_CONFIRM, message)
        if (!validation.valid) return this.invalid(session, validation.error, message)
        if (validation.value === false) {
            return this.capture(session, { nextState: CONVERSATION_STATE.OBJECTIVE }, conversationCopy.askObjective)
        }

        const draft = session.leadDraft
        const intake = await this.qualifyLeadUseCase.execute({
            phoneNumber: session.phoneNumber,
            name: draft.name ?? 'Paciente',
            objective: draft.objective ?? 'avaliacao geral',
            preferredWindow: draft.preferredWindow ?? 'nao informado',
            consent: true,
            source: 'sandbox',
            scorecard: {
                urgency: draft.urgency ?? 'baixa',
                objection: draft.objection ?? 'nenhuma',
            },
            conversationId: session.id,
        })

        const handoff = await this.dispatchHandoffUseCase.execute({
            leadId: intake.lead.id,
            reason: 'lead_qualificado_sandbox',
            requestedBy: 'sandbox',
        })

        const closed = await this.closeSession(session, [
            `${intake.lead.name}, recebi seus dados com sucesso.`,
            leadTemperatureMessage(intake.lead.temperature),
            'Nossa recepcao vai te chamar para confirmar o melhor horario.',
        ])

        return { ...closed, lead: intake.lead, handoff: handoff.handoff }
    }

    async capture(session, input, nextMessage) {
        const { session: updated } = await this.captureLeadFieldUseCase.execute({
            session,
            payload: input,
            nextState: input.nextState,
        })

        const messages = nextMessage ? [nextMessage] : []
        return { session: updated, messages }
    }

    async invalid(session, hint, message) {
        const updated = registerInvalidAttempt(session, session.state)
        await this.sessionRepository.save(updated)
        const attempts = Number(updated.invalidAttempts?.[session.state] ?? 0)
        if (this.policyService.isMaxInvalidAttemptsReached(attempts)) {
            return this.forwardToHuman(updated, message, 'ambiguidade_alta')
        }
        return { session: updated, messages: [`${conversationCopy.invalid}${hint}`] }
    }

    async forwardToHuman(session, objective, reason) {
        await this.dispatchHandoffUseCase.execute({
            reason,
            requestedBy: 'sandbox',
            manualPayload: {
                phoneNumber: session.phoneNumber,
                name: session.leadDraft.name ?? 'Paciente',
                objective,
                preferredWindow: session.leadDraft.preferredWindow ?? 'nao informado',
                scorecard: {
                    urgency: session.leadDraft.urgency ?? 'nao informado',
                    objection: session.leadDraft.objection ?? 'nao informado',
                },
                consent: { granted: false, source: 'sandbox', grantedAt: null },
            },
        })

        return this.closeSession(session, [conversationCopy.risk, conversationCopy.close])
    }

    async closeSession(session, messages) {
        const closed = updateSessionState(session, CONVERSATION_STATE.CLOSED)
        await this.sessionRepository.save(closed)
        return { session: closed, messages }
    }
}
