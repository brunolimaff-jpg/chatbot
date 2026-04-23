import { randomUUID } from 'node:crypto'

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
}) => {
    const timestamp = nowIso()

    return {
        id: randomUUID(),
        phoneNumber: normalizePhoneNumber(phoneNumber),
        channel: 'whatsapp',
        name: sanitizeText(name),
        objective: sanitizeText(objective),
        preferredWindow: sanitizeText(preferredWindow),
        interest,
        aiSummary,
        objectionTag,
        qualificationScore,
        temperature,
        risk,
        consent: {
            granted: Boolean(consent),
            source: source ?? 'chat',
            grantedAt: consent ? timestamp : null,
        },
        status,
        createdAt: timestamp,
        updatedAt: timestamp,
    }
}
