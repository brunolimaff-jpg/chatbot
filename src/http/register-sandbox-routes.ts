import { CHANNEL_MODE } from '../config/env.ts'
import { sendError, sendSuccess } from './http-response.ts'

const asText = (value) => String(value ?? '').trim()

const ensureSandboxMode = (env, res) => {
    if (env.channelMode === CHANNEL_MODE.SANDBOX) return true
    sendError(res, 409, 'sandbox routes are available only in CHATBOT_CHANNEL_MODE=sandbox', 'SANDBOX_DISABLED')
    return false
}

const registerSimulateMessageRoute = ({ provider, handleCtx, context, env }) => {
    provider.server.post(
        '/v1/simulate/message',
        handleCtx(async (_bot, req, res) => {
            if (!ensureSandboxMode(env, res)) return
            const payload = req.body ?? {}
            const from = asText(payload.from)
            const message = asText(payload.message)
            if (!from || !message) return sendError(res, 400, 'from and message are required', 'VALIDATION_ERROR')

            try {
                const result = await context.services.sandboxConversationService.handleMessage({
                    from,
                    message,
                    sessionId: asText(payload.sessionId) || null,
                })

                return sendSuccess(res, 200, {
                    sessionId: result.session.id,
                    state: result.session.state,
                    messages: result.messages,
                    leadId: result.lead?.id ?? null,
                    handoffId: result.handoff?.handoffId ?? null,
                })
            } catch (error) {
                return sendError(res, 422, error.message, 'SIMULATION_FAILED')
            }
        })
    )
}

const registerSimulateResetRoute = ({ provider, handleCtx, context, env }) => {
    provider.server.post(
        '/v1/simulate/reset',
        handleCtx(async (_bot, req, res) => {
            if (!ensureSandboxMode(env, res)) return
            const payload = req.body ?? {}
            const from = asText(payload.from) || null
            const sessionId = asText(payload.sessionId) || null
            if (!from && !sessionId) return sendError(res, 400, 'from or sessionId is required', 'VALIDATION_ERROR')

            try {
                await context.services.sandboxConversationService.reset({ from, sessionId })
                return sendSuccess(res, 200, { message: 'session_reset' })
            } catch (error) {
                return sendError(res, 422, error.message, 'SIMULATION_RESET_FAILED')
            }
        })
    )
}

const registerSimulateSessionRoute = ({ provider, handleCtx, context, env }) => {
    provider.server.get(
        '/v1/simulate/session',
        handleCtx(async (_bot, req, res) => {
            if (!ensureSandboxMode(env, res)) return
            const from = asText(req.query?.from) || null
            const sessionId = asText(req.query?.sessionId) || null
            if (!from && !sessionId) return sendError(res, 400, 'from or sessionId is required', 'VALIDATION_ERROR')

            const session = await context.services.sandboxConversationService.getSession({ from, sessionId })
            if (!session) return sendError(res, 404, 'session not found', 'SESSION_NOT_FOUND')
            return sendSuccess(res, 200, { session })
        })
    )
}

export const registerSandboxRoutes = ({ provider, handleCtx, context, env }) => {
    registerSimulateMessageRoute({ provider, handleCtx, context, env })
    registerSimulateResetRoute({ provider, handleCtx, context, env })
    registerSimulateSessionRoute({ provider, handleCtx, context, env })
}
