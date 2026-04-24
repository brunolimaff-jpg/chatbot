import { normalizePhoneNumber } from '../../domain/entities/lead.ts'

export class InMemoryConversationRepository {
    constructor() {
        this.sessionsByPhone = new Map()
        this.phoneBySessionId = new Map()
    }

    async save(session) {
        this.sessionsByPhone.set(normalizePhoneNumber(session.phoneNumber), session)
        this.phoneBySessionId.set(session.id, normalizePhoneNumber(session.phoneNumber))
        return session
    }

    async findByPhone(phoneNumber) {
        return this.sessionsByPhone.get(normalizePhoneNumber(phoneNumber)) ?? null
    }

    async findById(sessionId) {
        const phoneNumber = this.phoneBySessionId.get(sessionId)
        if (!phoneNumber) return null
        return this.sessionsByPhone.get(phoneNumber) ?? null
    }

    async deleteByPhone(phoneNumber) {
        const normalized = normalizePhoneNumber(phoneNumber)
        const session = this.sessionsByPhone.get(normalized)
        if (session) this.phoneBySessionId.delete(session.id)
        this.sessionsByPhone.delete(normalized)
    }

    async deleteById(sessionId) {
        const phoneNumber = this.phoneBySessionId.get(sessionId)
        if (!phoneNumber) return
        this.sessionsByPhone.delete(phoneNumber)
        this.phoneBySessionId.delete(sessionId)
    }
}
