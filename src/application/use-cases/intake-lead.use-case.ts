import { createLead, LEAD_STATUS, normalizePhoneNumber, sanitizeText } from '../../domain/entities/lead.ts'

const normalizeInput = (input = {}) => ({
    phoneNumber: normalizePhoneNumber(input.phoneNumber),
    name: sanitizeText(input.name),
    objective: sanitizeText(input.objective),
    preferredWindow: sanitizeText(input.preferredWindow || 'nao informado'),
    consent: Boolean(input.consent),
    source: input.source ?? 'chat',
    qualificationContext: input.qualificationContext ?? {},
})

const assertRequiredLeadInput = ({ phoneNumber, name, objective }) => {
    if (!phoneNumber) throw new Error('phoneNumber is required')
    if (!name) throw new Error('name is required')
    if (!objective) throw new Error('objective is required')
}

export class IntakeLeadUseCase {
    constructor({ leadRepository, aiAssistant, safetyGuardService, leadQualificationService }) {
        this.leadRepository = leadRepository
        this.aiAssistant = aiAssistant
        this.safetyGuardService = safetyGuardService
        this.leadQualificationService = leadQualificationService
    }

    async execute(input) {
        const normalizedInput = normalizeInput(input)
        assertRequiredLeadInput(normalizedInput)

        const aiAssessment = await this.aiAssistant.assessText(normalizedInput.objective)
        const risk = this.safetyGuardService.evaluateText(normalizedInput.objective)
        const qualification = this.leadQualificationService.scoreLead({
            consent: normalizedInput.consent,
            preferredWindow: normalizedInput.preferredWindow,
            aiAssessment,
            risk,
        })

        const lead = createLead({
            ...normalizedInput,
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
