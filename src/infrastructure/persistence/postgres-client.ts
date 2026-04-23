import { Pool } from 'pg'

let sharedPool = null

export const buildPostgresPool = async (databaseUrl = process.env.DATABASE_URL) => {
    if (!databaseUrl) return null

    if (!sharedPool) {
        sharedPool = new Pool({
            connectionString: databaseUrl,
            ssl: databaseUrl.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
        })
    }

    await sharedPool.query('SELECT 1')
    return sharedPool
}

export const ensureLeadTable = async (pool) => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            phone_number TEXT NOT NULL,
            status TEXT NOT NULL,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `)

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_leads_phone_number_created_at
        ON leads (phone_number, created_at DESC);
    `)
}
