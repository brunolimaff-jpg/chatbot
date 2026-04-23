export const CHANNEL_MODE = Object.freeze({
    WHATSAPP: 'whatsapp',
    SANDBOX: 'sandbox',
})

const SSL_MODE = Object.freeze({
    AUTO: 'auto',
    REQUIRE: 'require',
    DISABLE: 'disable',
})

const normalizeMode = (value = '') => {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()

    if (normalized === CHANNEL_MODE.SANDBOX) return CHANNEL_MODE.SANDBOX
    return CHANNEL_MODE.WHATSAPP
}

const parseBoolean = (value, defaultValue) => {
    if (value === undefined || value === null || value === '') return defaultValue
    const normalized = String(value).trim().toLowerCase()
    return ['1', 'true', 'yes', 'sim'].includes(normalized)
}

const parseWhatsAppVersion = (value = '') => {
    const normalized = String(value ?? '').trim()
    if (!normalized) return null
    const parts = normalized.split(',').map((part) => Number(part.trim()))
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null
    return parts
}

const parseSslMode = (value = '') => {
    const normalized = String(value ?? '').trim().toLowerCase()
    if (normalized === SSL_MODE.DISABLE) return SSL_MODE.DISABLE
    if (normalized === SSL_MODE.REQUIRE) return SSL_MODE.REQUIRE
    return SSL_MODE.AUTO
}

export const loadEnv = () => ({
    port: Number(process.env.PORT ?? 3008),
    channelMode: normalizeMode(process.env.CHATBOT_CHANNEL_MODE ?? CHANNEL_MODE.WHATSAPP),
    handoffWhatsappNumber: process.env.HANDOFF_WHATSAPP_NUMBER ?? '65981506458',
    whatsappUsePairingCode: (process.env.WHATSAPP_USE_PAIRING_CODE ?? 'false').toLowerCase() === 'true',
    whatsappPairingPhone: process.env.WHATSAPP_PAIRING_PHONE ?? null,
    whatsappProtocolVersion: parseWhatsAppVersion(process.env.WHATSAPP_PROTOCOL_VERSION ?? ''),
    databaseUrl: process.env.DATABASE_URL ?? '',
    databaseSslMode: parseSslMode(process.env.DATABASE_SSL_MODE ?? ''),
    databaseSslRejectUnauthorized: parseBoolean(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED, true),
    databaseSslCa: process.env.DATABASE_SSL_CA ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
})
