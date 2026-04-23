const normalizeDigits = (value = '') => String(value).replace(/\D/g, '')

const normalizeBrazilNumber = (value = '') => {
    const digits = normalizeDigits(value)
    if (!digits) return ''

    if (digits.startsWith('55')) return digits
    if (digits.length === 10 || digits.length === 11) return `55${digits}`
    return digits
}

export class ConsoleHandoffGateway {
    constructor(options = {}) {
        this.provider = options.provider ?? null
        this.targetNumber = normalizeBrazilNumber(options.targetNumber ?? '')
    }

    setProvider(provider) {
        this.provider = provider
    }

    setTargetNumber(targetNumber) {
        this.targetNumber = normalizeBrazilNumber(targetNumber)
    }

    buildMessage({ handoffId, dispatchedAt, payload }) {
        const riskLabel = payload?.risk?.highRisk ? 'ALTO RISCO' : 'sem alto risco'
        const consentLabel = payload?.consent?.granted ? 'sim' : 'nao'

        return [
            '*[Handoff Bot Clinica]*',
            `Handoff ID: ${handoffId}`,
            `Data: ${dispatchedAt}`,
            `Lead: ${payload?.name ?? 'nao informado'}`,
            `Telefone lead: ${payload?.phoneNumber ?? 'nao informado'}`,
            `Objetivo: ${payload?.objective ?? 'nao informado'}`,
            `Janela preferida: ${payload?.preferredWindow ?? 'nao informado'}`,
            `Interesse: ${payload?.interest ?? 'nao informado'}`,
            `Temperatura: ${payload?.temperature ?? 'nao informado'}`,
            `Score: ${payload?.qualificationScore ?? 'nao informado'}`,
            `Urgencia: ${payload?.scorecard?.urgency ?? 'nao informado'}`,
            `Objecao: ${payload?.scorecard?.objection ?? payload?.objectionTag ?? 'nao informado'}`,
            `Resumo IA: ${payload?.summary ?? payload?.aiSummary ?? 'nao informado'}`,
            `Risco: ${riskLabel}`,
            `Consentimento LGPD: ${consentLabel}`,
            `Motivo handoff: ${payload?.reason ?? 'nao informado'}`,
        ].join('\n')
    }

    async dispatch(payload) {
        if (!this.provider || typeof this.provider.sendMessage !== 'function') {
            throw new Error('Handoff provider is not configured')
        }

        if (!this.targetNumber) {
            throw new Error('Handoff target number is not configured')
        }

        const handoffId = `handoff-${Date.now()}`
        const dispatchedAt = new Date().toISOString()
        const message = this.buildMessage({ handoffId, dispatchedAt, payload })

        await this.provider.sendMessage(this.targetNumber, message)

        return {
            handoffId,
            dispatchedAt,
            channel: 'whatsapp',
            targetNumber: this.targetNumber,
        }
    }
}
