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
    'inchaço severo',
]

const DIAGNOSIS_REQUEST_KEYWORDS = [
    'diagnostico',
    'diagnóstico',
    'qual remedio',
    'qual remédio',
    'dosagem',
    'prescricao',
    'prescrição',
    'protocolo medico',
    'protocolo medico',
    'o que tomar',
]

const normalize = (text = '') =>
    String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

const findMatches = (normalizedText, keywords) =>
    keywords.filter((keyword) => normalizedText.includes(normalize(keyword)))

export class SafetyGuardService {
    evaluateText(text = '') {
        const normalizedText = normalize(text)
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
