import { normalizePhoneNumber } from '../../domain/entities/lead.ts'

export class PostgresLeadRepository {
    constructor({ pool }) {
        this.pool = pool
    }

    async save(lead) {
        const phoneNumber = normalizePhoneNumber(lead.phoneNumber)
        const now = new Date().toISOString()
        const payload = {
            ...lead,
            phoneNumber,
            updatedAt: now,
        }

        await this.pool.query(
            `
            INSERT INTO leads (id, phone_number, status, payload, created_at, updated_at)
            VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, NOW()), COALESCE($6::timestamptz, NOW()))
            ON CONFLICT (id) DO UPDATE
            SET
                phone_number = EXCLUDED.phone_number,
                status = EXCLUDED.status,
                payload = EXCLUDED.payload,
                updated_at = NOW();
            `,
            [
                payload.id,
                phoneNumber,
                payload.status,
                JSON.stringify(payload),
                payload.createdAt ?? null,
                payload.updatedAt ?? null,
            ]
        )

        return payload
    }

    async findById(id) {
        const result = await this.pool.query('SELECT payload FROM leads WHERE id = $1 LIMIT 1', [id])
        if (!result.rows.length) return null
        return result.rows[0].payload
    }

    async findLatestByPhone(phoneNumber) {
        const normalized = normalizePhoneNumber(phoneNumber)
        const result = await this.pool.query(
            `
            SELECT payload
            FROM leads
            WHERE phone_number = $1
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [normalized]
        )

        if (!result.rows.length) return null
        return result.rows[0].payload
    }

    async listAll() {
        const result = await this.pool.query('SELECT payload FROM leads ORDER BY created_at DESC')
        return result.rows.map((row) => row.payload)
    }
}
