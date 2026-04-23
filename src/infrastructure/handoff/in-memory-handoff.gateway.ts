export class InMemoryHandoffGateway {
    constructor(options = {}) {
        this.targetNumber = options.targetNumber ?? ''
        this.handoffs = []
    }

    setTargetNumber(targetNumber) {
        this.targetNumber = String(targetNumber ?? '').trim()
    }

    async dispatch(payload) {
        const handoffId = `sandbox-handoff-${Date.now()}`
        const dispatchedAt = new Date().toISOString()

        const handoff = {
            handoffId,
            dispatchedAt,
            channel: 'sandbox',
            targetNumber: this.targetNumber || 'sandbox-human-team',
            payload,
        }

        this.handoffs.unshift(handoff)
        return handoff
    }

    async listRecent(limit = 20) {
        return this.handoffs.slice(0, limit)
    }
}
