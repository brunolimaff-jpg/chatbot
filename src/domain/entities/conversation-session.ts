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
        createdAt: timestamp,
        updatedAt: timestamp,
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
})

export const persistConsentedHistory = (session) =>
    updateSession(session, {
        history: [...session.history, ...session.transientHistory],
        transientHistory: [],
    })

export const clearConversationData = (session) =>
    updateSession(session, {
        leadDraft: createEmptyLeadDraft(),
        history: [],
        transientHistory: [],
    })
