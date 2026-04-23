import { LEAD_STATUS, normalizePhoneNumber, nowIso } from '../../domain/entities/lead.ts'
import { retry } from '../../shared/retry.ts'

export class DispatchHandoffUseCase {
    constructor({ leadRepository, handoffGateway }) {
        this.leadRepository = leadRepository
        this.handoffGateway = handoffGateway
    }

    async execute(input) {
        const manualPayload = input?.manualPayload ?? null
        const lead = manualPayload ? null : await this.resolveLead(input)

        if (!lead && !manualPayload) {
            throw new Error('Lead not found')
        }

        const payload = this.buildPayload({
            lead,
            manualPayload,
            reason: input?.reason,
            requestedBy: input?.requestedBy,
        })

        const handoff = await this.dispatchWithOptionalTarget(payload, input?.targetNumber)

        if (!lead) {
            return {
                lead: null,
                handoff,
            }
        }

        const updatedLead = await this.markLeadAsForwarded(lead)
        return { lead: updatedLead, handoff }
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

    buildPayload({ lead, manualPayload, reason, requestedBy }) {
        if (manualPayload) return manualPayload

        return {
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
            scorecard: lead.scorecard,
            summary: lead.aiSummary,
            reason: reason ?? 'qualificacao_concluida',
            requestedBy: requestedBy ?? 'flow',
        }
    }

    async markLeadAsForwarded(lead) {
        const updatedLead = {
            ...lead,
            status: LEAD_STATUS.FORWARDED,
            updatedAt: nowIso(),
        }

        await this.leadRepository.save(updatedLead)
        return updatedLead
    }

    async dispatchWithOptionalTarget(payload, targetNumber) {
        const canSetTarget =
            typeof this.handoffGateway?.setTargetNumber === 'function' &&
            typeof targetNumber === 'string' &&
            targetNumber.trim().length > 0

        if (!canSetTarget) {
            return retry(() => this.handoffGateway.dispatch(payload), {
                attempts: 3,
                delayMs: 600,
            })
        }

        const previousTarget = this.handoffGateway.targetNumber
        this.handoffGateway.setTargetNumber(targetNumber)

        try {
            return await retry(() => this.handoffGateway.dispatch(payload), {
                attempts: 3,
                delayMs: 600,
            })
        } finally {
            this.handoffGateway.setTargetNumber(previousTarget)
        }
    }
}
