import { randomUUID } from 'node:crypto'
import { createConsent } from './consent.ts'
import { createScorecard, SCORECARD_OBJECTION, SCORECARD_URGENCY } from './scorecard.ts'

export const LEAD_STATUS = Object.freeze({
    NEW: 'novo',
    QUALIFIED: 'qualificado',
    FORWARDED: 'encaminhado',
    BLOCKED: 'bloqueado',
})

export const LEAD_TEMPERATURE = Object.freeze({
    HOT: 'quente',
    WARM: 'morno',
    COLD: 'frio',
})

export const LEAD_INTEREST = Object.freeze({
    GENERAL_EVALUATION: 'avaliacao_geral',
    SKIN_CARE: 'limpeza_pele',
    BOTULINUM: 'toxina_botulinica',
    FILLER: 'preenchimento',
    LASER: 'depilacao_laser',
    BIOSTIMULATOR: 'bioestimulador',
    OTHER: 'outro',
})

export const normalizePhoneNumber = (phoneNumber = '') => String(phoneNumber).replace(/\D/g, '')

export const sanitizeText = (value = '') => String(value).trim().replace(/\s+/g, ' ')

export const nowIso = () => new Date().toISOString()

export const isSpecificObjective = (objective = '', interest = LEAD_INTEREST.OTHER) => {
    const normalizedObjective = sanitizeText(objective).toLowerCase()
    if (!normalizedObjective) return false
    if (interest === LEAD_INTEREST.GENERAL_EVALUATION || interest === LEAD_INTEREST.OTHER) return false
    if (normalizedObjective.length < 10) return false
    return true
}

export const hasSpecificWindow = (windowText = '') => {
    const normalized = sanitizeText(windowText).toLowerCase()
    if (!normalized) return false

    const specificTerms = [
        'hoje',
        'amanha',
        'segunda',
        'terca',
        'quarta',
        'quinta',
        'sexta',
        'sabado',
        'domingo',
        'manha',
        'tarde',
        'noite',
        ':',
    ]

    return specificTerms.some((term) => normalized.includes(term))
}

export const createLead = ({
    phoneNumber,
    name,
    objective,
    preferredWindow,
    consent,
    source,
    interest,
    aiSummary,
    objectionTag,
    qualificationScore,
    temperature,
    risk,
    status,
    scorecard,
    conversationId,
}) => {
    const timestamp = nowIso()

    return {
        id: randomUUID(),
        phoneNumber: normalizePhoneNumber(phoneNumber),
        channel: 'whatsapp',
        name: sanitizeText(name),
        objective: sanitizeText(objective),
        preferredWindow: sanitizeText(preferredWindow),
        conversationId: conversationId ?? null,
        interest,
        aiSummary,
        objectionTag,
        scorecard: createScorecard({
            urgency: scorecard?.urgency ?? SCORECARD_URGENCY.LOW,
            objection: scorecard?.objection ?? SCORECARD_OBJECTION.NONE,
        }),
        qualificationScore,
        temperature,
        risk,
        consent: createConsent({
            granted: consent,
            source: source ?? 'chat',
            grantedAt: timestamp,
        }),
        status,
        createdAt: timestamp,
        updatedAt: timestamp,
    }
}
