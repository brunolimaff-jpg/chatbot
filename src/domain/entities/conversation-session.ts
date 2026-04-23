import { randomUUID } from 'node:crypto'

import { nowIso, normalizePhoneNumber, sanitizeText } from './lead.ts'

export const CONVERSATION_STATE = Object.freeze({
    ENTRY: 'ENTRY',
    INTENT_CONFIRM: 'INTENT_CONFIRM',
    NAME: 'NAME',
    OBJECTIVE: 'OBJECTIVE',
    SCORECARD_URGENCY: 'SCORECARD_URGENCY',
    SCORECARD_OBJECTION: 'SCORECARD_OBJECTION',
    PREFERRED_WINDOW: 'PREFERRED_WINDOW',
    LGPD_CONSENT: 'LGPD_CONSENT',
    SUMMARY_CONFIRM: 'SUMMARY_CONFIRM',
    HANDOFF_SENT: 'HANDOFF_SENT',
    CLOSED: 'CLOSED',
})

export const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000

const sanitizeOptional = (value) => {
    const text = sanitizeText(value ?? '')
    return text || null
}

export const createConversationSession = ({ phoneNumber, state = CONVERSATION_STATE.ENTRY }) => {
    const timestamp = nowIso()

    return {
        id: randomUUID(),
        phoneNumber: normalizePhoneNumber(phoneNumber),
        state,
        leadDraft: {
            name: null,
            objective: null,
            preferredWindow: null,
            urgency: null,
            objection: null,
            consent: null,
        },
        invalidAttempts: {},
        createdAt: timestamp,
        updatedAt: timestamp,
        expiresAt: new Date(Date.now() + SESSION_EXPIRATION_MS).toISOString(),
    }
}

export const updateSessionState = (session, state) => ({
    ...session,
    state,
    updatedAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_EXPIRATION_MS).toISOString(),
})

export const mergeSessionLeadDraft = (session, payload = {}) => ({
    ...session,
    leadDraft: {
        ...session.leadDraft,
        ...(payload.name !== undefined ? { name: sanitizeOptional(payload.name) } : {}),
        ...(payload.objective !== undefined ? { objective: sanitizeOptional(payload.objective) } : {}),
        ...(payload.preferredWindow !== undefined ? { preferredWindow: sanitizeOptional(payload.preferredWindow) } : {}),
        ...(payload.urgency !== undefined ? { urgency: sanitizeOptional(payload.urgency) } : {}),
        ...(payload.objection !== undefined ? { objection: sanitizeOptional(payload.objection) } : {}),
        ...(payload.consent !== undefined ? { consent: payload.consent } : {}),
    },
    updatedAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_EXPIRATION_MS).toISOString(),
})

export const registerInvalidAttempt = (session, state) => {
    const current = Number(session.invalidAttempts?.[state] ?? 0)

    return {
        ...session,
        invalidAttempts: {
            ...session.invalidAttempts,
            [state]: current + 1,
        },
        updatedAt: nowIso(),
        expiresAt: new Date(Date.now() + SESSION_EXPIRATION_MS).toISOString(),
    }
}

export const clearStateInvalidAttempts = (session, state) => ({
    ...session,
    invalidAttempts: {
        ...session.invalidAttempts,
        [state]: 0,
    },
    updatedAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_EXPIRATION_MS).toISOString(),
})

export const isSessionExpired = (session) => {
    if (!session?.updatedAt) return true
    const updatedAtMs = new Date(session.updatedAt).getTime()
    if (Number.isNaN(updatedAtMs)) return true
    return Date.now() - updatedAtMs > SESSION_EXPIRATION_MS
}
