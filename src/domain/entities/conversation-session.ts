import { randomUUID } from 'node:crypto'
import { normalizePhoneNumber, nowIso, sanitizeText } from './lead.ts'

export const CONVERSATION_STATE = Object.freeze({
    DISCOVERY: 'DISCOVERY',
    QUALIFYING: 'QUALIFYING',
    READY_FOR_HANDOFF: 'READY_FOR_HANDOFF',
    CLOSED: 'CLOSED',
    ENTRY: 'ENTRY',
    INTENT_CONFIRM: 'INTENT_CONFIRM',
    NAME: 'NAME',
    OBJECTIVE: 'OBJECTIVE',
    SCORECARD_URGENCY: 'SCORECARD_URGENCY',
    SCORECARD_OBJECTION: 'SCORECARD_OBJECTION',
    PREFERRED_WINDOW: 'PREFERRED_WINDOW',
    LGPD_CONSENT: 'LGPD_CONSENT',
})

export const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000

const expiresAt = () => new Date(Date.now() + SESSION_EXPIRATION_MS).toISOString()

const sanitizeOptional = (value) => {
    const text = sanitizeText(value ?? '')
    return text || null
}

export const createEmptyLeadDraft = () => ({
    name: null,
    objective: null,
    service: null,
    bodyArea: null,
    skinToneOrPhototype: null,
    budgetConcern: null,
    budgetPreference: null,
    preferredWindow: null,
    objection: null,
    urgency: null,
    expectationRisk: null,
    territoryHint: null,
    userNeighborhood: null,
    sourceCampaign: null,
    sourceAd: null,
    sourceUrl: null,
    handoffSummary: null,
    qualificationReasons: [],
    nextSuggestedAction: null,
    qualificationMissing: [],
    consent: null,
})

export const createConversationSession = ({ phoneNumber }) => {
    const timestamp = nowIso()

    return {
        id: randomUUID(),
        phoneNumber: normalizePhoneNumber(phoneNumber),
        state: CONVERSATION_STATE.DISCOVERY,
        leadDraft: createEmptyLeadDraft(),
        history: [],
        transientHistory: [],
        lastNlu: null,
        leadId: null,
        handoffId: null,
        invalidAttempts: {},
        createdAt: timestamp,
        updatedAt: timestamp,
        expiresAt: expiresAt(),
    }
}

export const appendTransientMessage = (session, role, content) => ({
    ...session,
    transientHistory: [
        ...session.transientHistory,
        {
            role,
            content: sanitizeText(content),
            at: nowIso(),
        },
    ],
    updatedAt: nowIso(),
    expiresAt: expiresAt(),
})

export const appendBotMessages = (session, messages = []) =>
    messages.reduce((current, message) => appendTransientMessage(current, 'assistant', message), session)

export const updateSession = (session, patch = {}) => ({
    ...session,
    ...patch,
    leadDraft: {
        ...session.leadDraft,
        ...(patch.leadDraft ?? {}),
    },
    updatedAt: nowIso(),
    expiresAt: expiresAt(),
})

export const persistConsentedHistory = (session) =>
    updateSession(session, {
        history: [...session.history, ...session.transientHistory],
        transientHistory: [],
    })

export const updateSessionState = (session, state) => updateSession(session, { state })

export const mergeSessionLeadDraft = (session, payload = {}) =>
    updateSession(session, {
        leadDraft: {
            ...('name' in payload ? { name: sanitizeOptional(payload.name) } : {}),
            ...('objective' in payload ? { objective: sanitizeOptional(payload.objective) } : {}),
            ...('preferredWindow' in payload ? { preferredWindow: sanitizeOptional(payload.preferredWindow) } : {}),
            ...('urgency' in payload ? { urgency: sanitizeOptional(payload.urgency) } : {}),
            ...('objection' in payload ? { objection: sanitizeOptional(payload.objection) } : {}),
            ...('consent' in payload ? { consent: payload.consent } : {}),
        },
    })

export const registerInvalidAttempt = (session, state) => ({
    ...session,
    invalidAttempts: {
        ...session.invalidAttempts,
        [state]: Number(session.invalidAttempts?.[state] ?? 0) + 1,
    },
    updatedAt: nowIso(),
    expiresAt: expiresAt(),
})

export const clearStateInvalidAttempts = (session, state) => ({
    ...session,
    invalidAttempts: {
        ...session.invalidAttempts,
        [state]: 0,
    },
    updatedAt: nowIso(),
    expiresAt: expiresAt(),
})

export const isSessionExpired = (session) => {
    if (!session?.updatedAt) return true
    const updatedAtMs = new Date(session.updatedAt).getTime()
    if (Number.isNaN(updatedAtMs)) return true
    return Date.now() - updatedAtMs > SESSION_EXPIRATION_MS
}

export const clearConversationData = (session) =>
    updateSession(session, {
        leadDraft: createEmptyLeadDraft(),
        history: [],
        transientHistory: [],
    })
