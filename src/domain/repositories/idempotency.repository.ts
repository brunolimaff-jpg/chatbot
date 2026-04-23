export class IdempotencyRepository {
    async acquire(_key, _ttlSeconds) {
        throw new Error('Method not implemented')
    }
}
