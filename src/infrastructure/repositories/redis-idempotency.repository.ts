export class RedisIdempotencyRepository {
    constructor({ client, keyPrefix = 'chatbot:idempotency' }) {
        this.client = client
        this.keyPrefix = keyPrefix
    }

    keyFor(key) {
        return `${this.keyPrefix}:${key}`
    }

    async acquire(key, ttlSeconds = 300) {
        const result = await this.client.set(this.keyFor(key), '1', {
            EX: ttlSeconds,
            NX: true,
        })

        return result === 'OK'
    }
}
