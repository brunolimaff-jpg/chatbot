import { normalizeForMatch } from '../../shared/text-normalizer.ts'

export const HIGH_RISK_KEYWORDS = [
    'dor intensa',
    'sangramento',
    'alergia',
    'falta de ar',
    'infeccao',
    'infecao',
    'febre',
    'necrose',
    'ardencia forte',
    'inchaco severo',
]

const DIAGNOSIS_REQUEST_KEYWORDS = [
    'diagnostico',
    'qual remedio',
    'dosagem',
    'prescricao',
    'protocolo medico',
    'o que tomar',
]

const findMatches = (normalizedText, keywords) =>
    keywords.filter((keyword) => normalizedText.includes(normalizeForMatch(keyword)))

export class SafetyGuardService {
    evaluateText(text = '') {
        const normalizedText = normalizeForMatch(text)
        const highRiskMatches = findMatches(normalizedText, HIGH_RISK_KEYWORDS)
        const diagnosisMatches = findMatches(normalizedText, DIAGNOSIS_REQUEST_KEYWORDS)

        const highRisk = highRiskMatches.length > 0
        const diagnosisRequest = diagnosisMatches.length > 0
        const matchedKeywords = [...highRiskMatches, ...diagnosisMatches]

        let recommendedAction = 'seguir_fluxo'
        if (highRisk) {
            recommendedAction = 'encaminhar_humano_imediato'
        } else if (diagnosisRequest) {
            recommendedAction = 'responder_limite_clinico'
        }

        return {
            highRisk,
            diagnosisRequest,
            matchedKeywords,
            recommendedAction,
        }
    }
}
