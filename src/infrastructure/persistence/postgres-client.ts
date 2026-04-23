import { Pool } from 'pg'

let sharedPool = null

const isLocalDatabase = (databaseUrl = '') => {
    const normalized = String(databaseUrl ?? '').toLowerCase()
    return normalized.includes('localhost') || normalized.includes('127.0.0.1')
}

const resolveSslEnabled = ({ databaseUrl, sslMode }) => {
    if (sslMode === 'disable') return false
    if (sslMode === 'require') return true
    if (databaseUrl.includes('sslmode=disable')) return false
    if (databaseUrl.includes('sslmode=require') || databaseUrl.includes('ssl=true')) return true
    return !isLocalDatabase(databaseUrl)
}

const buildSslConfig = (options) => {
    const sslEnabled = resolveSslEnabled(options)
    if (!sslEnabled) return false

    return {
        rejectUnauthorized: options.databaseSslRejectUnauthorized,
        ...(options.databaseSslCa ? { ca: options.databaseSslCa } : {}),
    }
}

export const buildPostgresPool = async (options = {}) => {
    const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL ?? ''
    if (!databaseUrl) return null

    if (!sharedPool) {
        sharedPool = new Pool({
            connectionString: databaseUrl,
            ssl: buildSslConfig({
                databaseUrl,
                sslMode: options.databaseSslMode ?? 'auto',
                databaseSslRejectUnauthorized: options.databaseSslRejectUnauthorized ?? true,
                databaseSslCa: options.databaseSslCa ?? '',
            }),
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
