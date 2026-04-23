import { createLead, LEAD_STATUS, normalizePhoneNumber, sanitizeText } from '../../domain/entities/lead.ts'
import { createScorecard, normalizeObjection, normalizeUrgency } from '../../domain/entities/scorecard.ts'

export class QualifyLeadUseCase {
    constructor({ leadRepository, aiAssistant, leadQualificationService, safetyGuardService }) {
        this.leadRepository = leadRepository
        this.aiAssistant = aiAssistant
        this.leadQualificationService = leadQualificationService
        this.safetyGuardService = safetyGuardService
    }

    async execute(input) {
        const normalized = this.normalizeInput(input)
        this.validateInput(normalized)

        const aiAssessment = await this.aiAssistant.assessText(normalized.objective)
        const risk = this.safetyGuardService.evaluateText(normalized.objective)
        const scorecard = this.resolveScorecard(input, aiAssessment)

        const qualification = this.leadQualificationService.scoreLead({
            consent: normalized.consent,
            objective: normalized.objective,
            preferredWindow: normalized.preferredWindow,
            aiAssessment,
            risk,
            scorecard,
        })

        const lead = createLead({
            phoneNumber: normalized.phoneNumber,
            name: normalized.name,
            objective: normalized.objective,
            preferredWindow: normalized.preferredWindow,
            consent: normalized.consent,
            source: normalized.source,
            interest: aiAssessment.interest,
            aiSummary: aiAssessment.summary,
            objectionTag: scorecard.objection,
            qualificationScore: qualification.score,
            temperature: qualification.temperature,
            risk,
            status: risk.highRisk ? LEAD_STATUS.BLOCKED : LEAD_STATUS.QUALIFIED,
            scorecard,
            conversationId: normalized.conversationId,
        })

        await this.leadRepository.save(lead)
        return this.buildResult({ lead, aiAssessment, risk, qualification })
    }

    normalizeInput(input) {
        return {
            phoneNumber: normalizePhoneNumber(input?.phoneNumber),
            name: sanitizeText(input?.name),
            objective: sanitizeText(input?.objective),
            preferredWindow: sanitizeText(input?.preferredWindow || 'nao informado'),
            consent: input?.consent === true,
            source: input?.source ?? 'chat',
            conversationId: input?.conversationId ?? null,
        }
    }

    validateInput(input) {
        if (!input.phoneNumber) throw new Error('phoneNumber is required')
        if (!input.name) throw new Error('name is required')
        if (!input.objective) throw new Error('objective is required')
        if (!input.consent) throw new Error('consent is required')
    }

    resolveScorecard(input, aiAssessment) {
        return createScorecard({
            urgency: normalizeUrgency(input?.scorecard?.urgency ?? aiAssessment.urgency),
            objection: normalizeObjection(input?.scorecard?.objection ?? aiAssessment.objectionTag),
        })
    }

    buildResult(payload) {
        return {
            lead: payload.lead,
            aiAssessment: payload.aiAssessment,
            risk: payload.risk,
            qualification: payload.qualification,
            nextAction: payload.risk.highRisk ? 'handoff_imediato' : 'qualificar_e_encaminhar',
        }
    }
}
