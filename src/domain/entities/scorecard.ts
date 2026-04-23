import { normalizeForMatch } from '../../shared/text-normalizer.ts'

export const SCORECARD_URGENCY = Object.freeze({
    HIGH: 'alta',
    MEDIUM: 'media',
    LOW: 'baixa',
})

export const SCORECARD_OBJECTION = Object.freeze({
    PRICE: 'preco',
    PAIN: 'dor',
    RECOVERY: 'recuperacao',
    SAFETY: 'seguranca',
    OTHER: 'outro',
    NONE: 'nenhuma',
})

const includesAny = (text, words) => words.some((word) => text.includes(word))

export const normalizeUrgency = (value = '') => {
    const normalized = normalizeForMatch(value)
    if (!normalized) return null

    if (includesAny(normalized, ['urgente', 'hoje', 'amanha', 'evento', 'casamento', 'o quanto antes'])) {
        return SCORECARD_URGENCY.HIGH
    }

    if (includesAny(normalized, ['semana', 'proximos dias', 'em breve'])) {
        return SCORECARD_URGENCY.MEDIUM
    }

    return SCORECARD_URGENCY.LOW
}

export const normalizeObjection = (value = '') => {
    const normalized = normalizeForMatch(value)
    if (!normalized) return null

    if (includesAny(normalized, ['preco', 'valor', 'custa', 'caro'])) return SCORECARD_OBJECTION.PRICE
    if (includesAny(normalized, ['dor', 'doi'])) return SCORECARD_OBJECTION.PAIN
    if (includesAny(normalized, ['recuperacao', 'afastado', 'tempo'])) return SCORECARD_OBJECTION.RECOVERY
    if (includesAny(normalized, ['seguranca', 'risco', 'efeito colateral'])) return SCORECARD_OBJECTION.SAFETY
    if (includesAny(normalized, ['nenhuma', 'sem objecao', 'nao tenho'])) return SCORECARD_OBJECTION.NONE

    return SCORECARD_OBJECTION.OTHER
}

export const createScorecard = ({ urgency, objection }) => ({
    urgency: urgency ?? SCORECARD_URGENCY.LOW,
    objection: objection ?? SCORECARD_OBJECTION.NONE,
})
