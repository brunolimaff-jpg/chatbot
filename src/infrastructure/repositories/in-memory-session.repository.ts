import { normalizePhoneNumber } from '../../domain/entities/lead.ts'

export class InMemorySessionRepository {
    constructor() {
        this.sessionsByPhone = new Map()
        this.sessionIdByPhone = new Map()
        this.phoneBySessionId = new Map()
    }

    async save(session) {
        const phoneNumber = normalizePhoneNumber(session.phoneNumber)
        const previousSessionId = this.sessionIdByPhone.get(phoneNumber)
        if (previousSessionId && previousSessionId !== session.id) {
            this.phoneBySessionId.delete(previousSessionId)
        }

        this.sessionsByPhone.set(phoneNumber, session)
        this.sessionIdByPhone.set(phoneNumber, session.id)
        this.phoneBySessionId.set(session.id, phoneNumber)
        return session
    }

    async findByPhone(phoneNumber) {
        return this.sessionsByPhone.get(normalizePhoneNumber(phoneNumber)) ?? null
    }

    async findById(sessionId) {
        const phoneNumber = this.phoneBySessionId.get(String(sessionId))
        if (!phoneNumber) return null
        return this.sessionsByPhone.get(phoneNumber) ?? null
    }

    async deleteByPhone(phoneNumber) {
        const normalized = normalizePhoneNumber(phoneNumber)
        const sessionId = this.sessionIdByPhone.get(normalized)
        if (sessionId) {
            this.phoneBySessionId.delete(sessionId)
            this.sessionIdByPhone.delete(normalized)
        }
        this.sessionsByPhone.delete(normalized)
    }

    async deleteById(sessionId) {
        const normalizedSessionId = String(sessionId)
        const phoneNumber = this.phoneBySessionId.get(normalizedSessionId)
        if (!phoneNumber) return
        this.sessionsByPhone.delete(phoneNumber)
        this.sessionIdByPhone.delete(phoneNumber)
        this.phoneBySessionId.delete(normalizedSessionId)
    }
}
