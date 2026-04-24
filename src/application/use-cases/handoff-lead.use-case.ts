import { LEAD_STATUS, normalizePhoneNumber, nowIso } from '../../domain/entities/lead.ts'
import { retry } from '../../shared/retry.ts'

const buildHandoffPayload = (lead, input) => ({
    leadId: lead.id,
    phoneNumber: lead.phoneNumber,
    name: lead.name,
    objective: lead.objective,
    preferredWindow: lead.preferredWindow,
    interest: lead.interest,
    temperature: lead.temperature,
    qualificationScore: lead.qualificationScore,
    risk: lead.risk,
    consent: lead.consent,
    summary: lead.aiSummary,
    qualificationContext: lead.qualificationContext ?? {},
    handoffSummary: lead.qualificationContext?.handoffSummary ?? lead.aiSummary,
    nextSuggestedAction: lead.qualificationContext?.nextSuggestedAction ?? null,
    reason: input?.reason ?? 'qualificacao_concluida',
    requestedBy: input?.requestedBy ?? 'flow',
})

export class HandoffLeadUseCase {
    constructor({ leadRepository, handoffGateway }) {
        this.leadRepository = leadRepository
        this.handoffGateway = handoffGateway
    }

    async execute(input) {
        const lead = await this.resolveLead(input)
        if (!lead) {
            throw new Error('Lead not found')
        }

        const handoff = await retry(() => this.handoffGateway.dispatch(buildHandoffPayload(lead, input)), {
            attempts: 3,
            delayMs: 600,
        })

        const updatedLead = {
            ...lead,
            status: LEAD_STATUS.FORWARDED,
            updatedAt: nowIso(),
        }

        await this.leadRepository.save(updatedLead)

        return {
            lead: updatedLead,
            handoff,
        }
    }

    async resolveLead(input) {
        if (input?.leadId) {
            return this.leadRepository.findById(input.leadId)
        }

        if (input?.phoneNumber) {
            const phoneNumber = normalizePhoneNumber(input.phoneNumber)
            return this.leadRepository.findLatestByPhone(phoneNumber)
        }

        return null
    }
}
