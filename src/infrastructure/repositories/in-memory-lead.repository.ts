export class InMemoryLeadRepository {
    constructor() {
        this.leadsById = new Map()
        this.latestLeadIdByPhone = new Map()
    }

    async save(lead) {
        this.leadsById.set(lead.id, lead)
        this.latestLeadIdByPhone.set(lead.phoneNumber, lead.id)
        return lead
    }

    async findById(id) {
        return this.leadsById.get(id) ?? null
    }

    async findLatestByPhone(phoneNumber) {
        const leadId = this.latestLeadIdByPhone.get(phoneNumber)
        if (!leadId) return null
        return this.leadsById.get(leadId) ?? null
    }

    async listAll() {
        return Array.from(this.leadsById.values())
    }
}
