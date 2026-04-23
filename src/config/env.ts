export const CHANNEL_MODE = Object.freeze({
    WHATSAPP: 'whatsapp',
    SANDBOX: 'sandbox',
})

const normalizeMode = (value = '') => {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()

    if (normalized === CHANNEL_MODE.SANDBOX) return CHANNEL_MODE.SANDBOX
    return CHANNEL_MODE.WHATSAPP
}

export const loadEnv = () => ({
    port: Number(process.env.PORT ?? 3008),
    channelMode: normalizeMode(process.env.CHATBOT_CHANNEL_MODE ?? CHANNEL_MODE.WHATSAPP),
    handoffWhatsappNumber: process.env.HANDOFF_WHATSAPP_NUMBER ?? '65981506458',
    whatsappUsePairingCode: (process.env.WHATSAPP_USE_PAIRING_CODE ?? 'false').toLowerCase() === 'true',
    whatsappPairingPhone: process.env.WHATSAPP_PAIRING_PHONE ?? null,
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
})
