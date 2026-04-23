import { createClient } from 'redis'

export const buildRedisClient = async (redisUrl = process.env.REDIS_URL) => {
    if (!redisUrl) return null

    const client = createClient({
        url: redisUrl,
    })

    client.on('error', (error) => {
        console.error('[redis] client error:', error)
    })

    if (!client.isOpen) {
        await client.connect()
    }

    return client
}
