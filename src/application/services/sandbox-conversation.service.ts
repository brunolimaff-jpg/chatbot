import {
    appendBotMessages,
    appendTransientMessage,
    CONVERSATION_STATE,
    createConversationSession,
    persistConsentedHistory,
    updateSession,
} from '../../domain/entities/conversation-session.ts'
import {
    buildQualificationContext,
    textSlotFields,
    usefulDetailFields,
} from './sandbox-handoff-context.ts'

const fallbackObjective = (session, message) => session.leadDraft.objective ?? (String(message ?? '').trim() || 'avaliacao personalizada')
const immediateHandoffIntents = new Set(['clinical_risk', 'human_request'])

export class SandboxConversationService {
    constructor({
        conversationRepository,
        catalogService,
        orchestratorService,
        safetyGuardService,
        intakeLeadUseCase,
        handoffLeadUseCase,
    }) {
        this.conversationRepository = conversationRepository
        this.catalogService = catalogService
        this.orchestratorService = orchestratorService
        this.safetyGuardService = safetyGuardService
        this.intakeLeadUseCase = intakeLeadUseCase
        this.handoffLeadUseCase = handoffLeadUseCase
    }

    async handleMessage(input) {
        const from = String(input?.from ?? '').trim()
        const message = String(input?.message ?? '').trim()
        if (!from || !message) throw new Error('from and message are required')

        let session = await this.findOrCreateSession(from)
        session = this.applyInputMetadata(session, input)
        session = appendTransientMessage(session, 'user', message)

        const decision = await this.orchestratorService.analyze({ message, session })
        session = this.applyDecision(session, decision, message)
        const executableDecision = this.applyHandoffQualificationGate(session, decision)

        if (executableDecision.handoff.recommended && !session.leadId) {
            session = await this.dispatchHandoff(session, executableDecision, message)
        }

        if (session.state !== executableDecision.nextState) {
            session = updateSession(session, { state: executableDecision.nextState })
        }

        return this.saveAndReply(session, executableDecision, [executableDecision.reply])
    }

    async reset(input) {
        if (input?.sessionId) return this.conversationRepository.deleteById(input.sessionId)
        return this.conversationRepository.deleteByPhone(input?.from)
    }

    async getSession(input) {
        if (input?.sessionId) return this.conversationRepository.findById(input.sessionId)
        return this.conversationRepository.findByPhone(input?.from)
    }

    async findOrCreateSession(from) {
        const existing = await this.conversationRepository.findByPhone(from)
        if (existing) return existing
        const session = createConversationSession({ phoneNumber: from })
        await this.conversationRepository.save(session)
        return session
    }

    applyDecision(session, decision, message) {
        const slots = decision.slots ?? {}
        const serviceLabel = typeof slots.service === 'string' ? slots.service : slots.service?.label
        const objective = slots.objective ?? (serviceLabel ? `${serviceLabel}: ${message}` : undefined)
        const leadDraft = {}

        if (serviceLabel !== undefined && serviceLabel !== null && String(serviceLabel).trim()) {
            leadDraft.service = String(serviceLabel).trim()
        }
        if (slots.name !== undefined && slots.name !== null && String(slots.name).trim()) {
            leadDraft.name = String(slots.name).trim()
        }
        if (objective !== undefined && objective !== null && String(objective).trim()) {
            leadDraft.objective = String(objective).trim()
        }
        for (const field of textSlotFields) {
            if (slots[field] !== undefined && slots[field] !== null && String(slots[field]).trim()) {
                leadDraft[field] = String(slots[field]).trim()
            }
        }
        if (slots.budgetConcern !== undefined && slots.budgetConcern !== null) {
            leadDraft.budgetConcern = Boolean(slots.budgetConcern)
        }
        if (Array.isArray(slots.qualificationReasons)) {
            leadDraft.qualificationReasons = slots.qualificationReasons.map((item) => String(item).trim()).filter(Boolean)
        }
        if (Array.isArray(slots.qualificationMissing)) {
            leadDraft.qualificationMissing = slots.qualificationMissing
        }

        return updateSession(session, {
            state: decision.nextState,
            lastNlu: decision,
            leadDraft,
        })
    }

    applyHandoffQualificationGate(session, decision) {
        if (!decision.handoff.recommended) return decision
        if (immediateHandoffIntents.has(decision.intent)) return decision
        if (decision.intent === 'schedule_interest' && session.leadDraft.objective) return decision
        if (this.isQualificationComplete(session.leadDraft)) return decision

        return {
            ...decision,
            nextState: CONVERSATION_STATE.QUALIFYING,
            handoff: {
                ...decision.handoff,
                recommended: false,
                blockedReason: 'qualification_incomplete',
            },
            slots: {
                ...decision.slots,
                qualificationMissing: this.resolveMissingQualification(session.leadDraft),
            },
        }
    }

    isQualificationComplete(draft = {}) {
        return Boolean(draft.objective && draft.service && usefulDetailFields.some((field) => Boolean(draft[field])))
    }

    resolveMissingQualification(draft = {}) {
        const missing = []
        if (!draft.objective) missing.push('objective')
        if (!draft.service) missing.push('service')
        if (!usefulDetailFields.some((field) => Boolean(draft[field]))) missing.push('useful_detail')
        return missing
    }

    async dispatchHandoff(session, decision, message) {
        const intake = await this.intakeLeadUseCase.execute({
            phoneNumber: session.phoneNumber,
            name: session.leadDraft.name ?? 'Paciente',
            objective: fallbackObjective(session, message),
            preferredWindow: session.leadDraft.preferredWindow ?? 'nao informado',
            consent: true,
            source: 'sandbox',
            qualificationContext: buildQualificationContext(session.leadDraft, decision),
        })

        const handoff = await this.handoffLeadUseCase.execute({
            leadId: intake.lead.id,
            reason: decision.handoff.reason ?? decision.intent,
            requestedBy: decision.source,
        })

        return updateSession(session, {
            state: decision.nextState,
            leadId: intake.lead.id,
            handoffId: handoff.handoff.handoffId,
        })
    }

    async saveAndReply(session, decision, messages) {
        const withMessages = persistConsentedHistory(
            appendBotMessages(updateSession(session, { lastNlu: decision }), messages)
        )
        await this.conversationRepository.save(withMessages)
        return this.response(withMessages, decision, messages)
    }

    response(session, decision, messages) {
        return {
            status: 'ok',
            session,
            sessionId: session.id,
            state: session.state,
            messages,
            nlu: decision,
            leadId: session.leadId,
            handoffId: session.handoffId,
        }
    }

    applyInputMetadata(session, input = {}) {
        const referral = input.referral ?? input.metadata?.referral ?? null
        const leadDraft = {}

        const sourceCampaign = input.sourceCampaign ?? input.campaign ?? referral?.headline ?? referral?.source_id
        const sourceAd = input.sourceAd ?? referral?.body ?? referral?.source_type
        const sourceUrl = input.sourceUrl ?? referral?.source_url

        if (sourceCampaign) leadDraft.sourceCampaign = String(sourceCampaign).trim()
        if (sourceAd) leadDraft.sourceAd = String(sourceAd).trim()
        if (sourceUrl) leadDraft.sourceUrl = String(sourceUrl).trim()

        if (!Object.keys(leadDraft).length) return session
        return updateSession(session, { leadDraft })
    }

}
