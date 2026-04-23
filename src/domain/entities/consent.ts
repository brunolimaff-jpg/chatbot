export const CONSENT_SOURCE = Object.freeze({
    CHAT: 'chat',
    API: 'api',
})

export const createConsent = ({ granted, source, grantedAt }) => ({
    granted: Boolean(granted),
    source: source ?? CONSENT_SOURCE.CHAT,
    grantedAt: granted ? grantedAt ?? new Date().toISOString() : null,
})
