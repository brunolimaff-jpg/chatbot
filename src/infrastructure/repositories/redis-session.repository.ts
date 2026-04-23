import { normalizePhoneNumber } from '../../domain/entities/lead.ts'

const DEFAULT_TTL_SECONDS = 24 * 60 * 60

export class RedisSessionRepository {
    constructor({ client, ttlSeconds = DEFAULT_TTL_SECONDS }) {
        this.client = client
        this.ttlSeconds = ttlSeconds
    }

    sessionKey(phoneNumber) {
        return `chatbot:session:${normalizePhoneNumber(phoneNumber)}`
    }

    sessionIdRefKey(sessionId) {
        return `chatbot:session:id:${String(sessionId)}`
    }

    async save(session) {
        const key = this.sessionKey(session.phoneNumber)

        await this.client.set(key, JSON.stringify(session), {
            EX: this.ttlSeconds,
        })

        await this.client.set(this.sessionIdRefKey(session.id), normalizePhoneNumber(session.phoneNumber), {
            EX: this.ttlSeconds,
        })

        return session
    }

    async findByPhone(phoneNumber) {
        const raw = await this.client.get(this.sessionKey(phoneNumber))
        if (!raw) return null
        return JSON.parse(raw)
    }

    async findById(sessionId) {
        const phoneNumber = await this.client.get(this.sessionIdRefKey(sessionId))
        if (!phoneNumber) return null
        return this.findByPhone(phoneNumber)
    }

    async deleteByPhone(phoneNumber) {
        const key = this.sessionKey(phoneNumber)
        const raw = await this.client.get(key)
        if (raw) {
            const session = JSON.parse(raw)
            await this.client.del(this.sessionIdRefKey(session.id))
        }
        await this.client.del(key)
    }

    async deleteById(sessionId) {
        const refKey = this.sessionIdRefKey(sessionId)
        const phoneNumber = await this.client.get(refKey)
        if (!phoneNumber) return
        await this.client.del(refKey)
        await this.client.del(this.sessionKey(phoneNumber))
    }
}
