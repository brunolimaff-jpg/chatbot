import { clearStateInvalidAttempts, mergeSessionLeadDraft, updateSessionState } from '../../domain/entities/conversation-session.ts'

export class CaptureLeadFieldUseCase {
    constructor({ sessionRepository }) {
        this.sessionRepository = sessionRepository
    }

    async execute(input) {
        const session = input?.session
        if (!session) throw new Error('session is required')

        const mergedSession = mergeSessionLeadDraft(session, input?.payload ?? {})
        const transitionedSession = updateSessionState(mergedSession, input?.nextState ?? session.state)
        const normalizedSession = clearStateInvalidAttempts(transitionedSession, session.state)

        await this.sessionRepository.save(normalizedSession)
        return {
            session: normalizedSession,
        }
    }
}
