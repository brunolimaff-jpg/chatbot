import { LEAD_TEMPERATURE } from '../entities/lead.ts'

const hasSpecificWindow = (windowText = '') => {
    const normalized = String(windowText).toLowerCase()
    const specificTerms = [
        'hoje',
        'amanha',
        'amanhã',
        'segunda',
        'terca',
        'terça',
        'quarta',
        'quinta',
        'sexta',
        'sabado',
        'sábado',
        'manha',
        'manhã',
        'tarde',
        'noite',
        ':',
    ]

    return specificTerms.some((term) => normalized.includes(term))
}

export class LeadQualificationService {
    scoreLead({ consent, preferredWindow, aiAssessment, risk }) {
        if (risk?.highRisk) {
            return {
                score: 5,
                temperature: LEAD_TEMPERATURE.COLD,
            }
        }

        let score = 0

        if (consent) score += 35
        if (hasSpecificWindow(preferredWindow)) score += 20

        if (aiAssessment?.urgency === 'alta') score += 20
        if (aiAssessment?.urgency === 'media') score += 12
        if (aiAssessment?.interest && aiAssessment.interest !== 'avaliacao_geral') score += 15

        if (aiAssessment?.objectionTag === 'preco') score -= 10
        if (aiAssessment?.objectionTag === 'seguranca') score -= 6
        if (aiAssessment?.objectionTag === 'dor') score -= 5
        if (aiAssessment?.objectionTag === 'tempo_recuperacao') score -= 4

        const boundedScore = Math.max(0, Math.min(score, 100))

        let temperature = LEAD_TEMPERATURE.COLD
        if (boundedScore >= 70) temperature = LEAD_TEMPERATURE.HOT
        else if (boundedScore >= 45) temperature = LEAD_TEMPERATURE.WARM

        return {
            score: boundedScore,
            temperature,
        }
    }
}
