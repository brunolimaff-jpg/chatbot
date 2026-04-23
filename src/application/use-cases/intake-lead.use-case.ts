import { createLead, LEAD_STATUS, normalizePhoneNumber, sanitizeText } from '../../domain/entities/lead.ts'

export class IntakeLeadUseCase {
    constructor({ leadRepository, aiAssistant, safetyGuardService, leadQualificationService }) {
        this.leadRepository = leadRepository
        this.aiAssistant = aiAssistant
        this.safetyGuardService = safetyGuardService
        this.leadQualificationService = leadQualificationService
    }

    async execute(input) {
        const phoneNumber = normalizePhoneNumber(input?.phoneNumber)
        const name = sanitizeText(input?.name)
        const objective = sanitizeText(input?.objective)
        const preferredWindow = sanitizeText(input?.preferredWindow || 'nao informado')
        const consent = Boolean(input?.consent)
        const source = input?.source ?? 'chat'

        if (!phoneNumber) {
            throw new Error('phoneNumber is required')
        }

        if (!name) {
            throw new Error('name is required')
        }

        if (!objective) {
            throw new Error('objective is required')
        }

        const aiAssessment = await this.aiAssistant.assessText(objective)
        const risk = this.safetyGuardService.evaluateText(objective)
        const qualification = this.leadQualificationService.scoreLead({
            consent,
            preferredWindow,
            aiAssessment,
            risk,
        })

        const lead = createLead({
            phoneNumber,
            name,
            objective,
            preferredWindow,
            consent,
            source,
            interest: aiAssessment.interest,
            aiSummary: aiAssessment.summary,
            objectionTag: aiAssessment.objectionTag,
            qualificationScore: qualification.score,
            temperature: qualification.temperature,
            risk,
            status: risk.highRisk ? LEAD_STATUS.BLOCKED : LEAD_STATUS.QUALIFIED,
        })

        await this.leadRepository.save(lead)

        return {
            lead,
            aiAssessment,
            risk,
            nextAction: risk.highRisk ? 'handoff_imediato' : 'qualificar_e_agendar',
        }
    }
}
