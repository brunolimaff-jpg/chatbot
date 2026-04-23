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

const buildLeadScorecard = (scorecard) =>
    createScorecard({
        urgency: scorecard?.urgency ?? SCORECARD_URGENCY.LOW,
        objection: scorecard?.objection ?? SCORECARD_OBJECTION.NONE,
    })

const buildLeadConsent = (consent, source, timestamp) =>
    createConsent({
        granted: consent,
        source: source ?? 'chat',
        grantedAt: timestamp,
    })

const buildNormalizedLeadContent = ({ phoneNumber, name, objective, preferredWindow, conversationId }) => ({
    phoneNumber: normalizePhoneNumber(phoneNumber),
    channel: 'whatsapp',
    name: sanitizeText(name),
    objective: sanitizeText(objective),
    preferredWindow: sanitizeText(preferredWindow),
    conversationId: conversationId ?? null,
})

export const createLead = (input) => {
    const timestamp = nowIso()
    const normalized = buildNormalizedLeadContent(input)

    return {
        id: randomUUID(),
        ...normalized,
        interest: input.interest,
        aiSummary: input.aiSummary,
        objectionTag: input.objectionTag,
        scorecard: buildLeadScorecard(input.scorecard),
        qualificationScore: input.qualificationScore,
        temperature: input.temperature,
        risk: input.risk,
        consent: buildLeadConsent(input.consent, input.source, timestamp),
        status: input.status,
        createdAt: timestamp,
        updatedAt: timestamp,
    }
}
