const wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))

export const retry = async (task, options = {}) => {
    const attempts = options.attempts ?? 3
    const delayMs = options.delayMs ?? 500

    let lastError

    for (let currentAttempt = 1; currentAttempt <= attempts; currentAttempt += 1) {
        try {
            return await task()
        } catch (error) {
            lastError = error
            if (currentAttempt < attempts) {
                await wait(delayMs)
            }
        }
    }

    throw lastError
}
