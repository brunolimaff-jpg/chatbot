import { createConversationSession, isSessionExpired } from '../../domain/entities/conversation-session.ts'
import { normalizePhoneNumber } from '../../domain/entities/lead.ts'

export class StartOrResumeConversationUseCase {
    constructor({ sessionRepository }) {
        this.sessionRepository = sessionRepository
    }

    async execute(input) {
        const phoneNumber = normalizePhoneNumber(input?.phoneNumber)
        if (!phoneNumber) {
            throw new Error('phoneNumber is required')
        }

        const existingSession = await this.sessionRepository.findByPhone(phoneNumber)
        if (!existingSession) {
            const newSession = createConversationSession({ phoneNumber })
            await this.sessionRepository.save(newSession)
            return {
                session: newSession,
                mode: 'started',
            }
        }

        if (isSessionExpired(existingSession)) {
            const restartedSession = createConversationSession({ phoneNumber })
            await this.sessionRepository.save(restartedSession)
            return {
                session: restartedSession,
                mode: 'expired_restarted',
            }
        }

        return {
            session: existingSession,
            mode: 'resumed',
        }
    }
}
