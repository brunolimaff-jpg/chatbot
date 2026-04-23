export class InMemoryIdempotencyRepository {
    constructor() {
        this.keys = new Map()
    }

    async acquire(key, ttlSeconds = 300) {
        const now = Date.now()
        const existing = this.keys.get(key)
        if (existing && existing > now) {
            return false
        }

        this.keys.set(key, now + ttlSeconds * 1000)
        return true
    }
}
