import { hasSpecificWindow, isSpecificObjective, LEAD_TEMPERATURE } from '../entities/lead.ts'
import { SCORECARD_OBJECTION, SCORECARD_URGENCY } from '../entities/scorecard.ts'

export class LeadQualificationService {
    scoreLead({ consent, objective, preferredWindow, aiAssessment, risk, scorecard }) {
        if (risk?.highRisk) {
            return {
                score: 5,
                temperature: LEAD_TEMPERATURE.COLD,
            }
        }

        let score = 0

        if (consent) score += 25
        if (isSpecificObjective(objective, aiAssessment?.interest)) score += 20
        if (hasSpecificWindow(preferredWindow)) score += 20

        const urgency = scorecard?.urgency ?? aiAssessment?.urgency ?? SCORECARD_URGENCY.LOW
        const objection = scorecard?.objection ?? aiAssessment?.objectionTag ?? SCORECARD_OBJECTION.NONE

        if (urgency === SCORECARD_URGENCY.HIGH) score += 20
        if (urgency === SCORECARD_URGENCY.MEDIUM) score += 12
        if (urgency === SCORECARD_URGENCY.LOW) score += 5

        if (objection === SCORECARD_OBJECTION.PRICE) score -= 10
        if (objection === SCORECARD_OBJECTION.SAFETY) score -= 6
        if (objection === SCORECARD_OBJECTION.PAIN) score -= 5
        if (objection === SCORECARD_OBJECTION.RECOVERY) score -= 4

        const boundedScore = Math.max(0, Math.min(score, 100))

        let temperature = LEAD_TEMPERATURE.COLD
        if (boundedScore >= 75) temperature = LEAD_TEMPERATURE.HOT
        else if (boundedScore >= 50) temperature = LEAD_TEMPERATURE.WARM

        return {
            score: boundedScore,
            temperature,
        }
    }
}
