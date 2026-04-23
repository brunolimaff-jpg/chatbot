import { retry } from '../shared/retry.ts'
import { sendError, sendSuccess } from './http-response.ts'

const asText = (value) => String(value ?? '').trim()

const asBoolean = (value) => {
    if (value === true || value === false) return value
    const normalized = asText(value).toLowerCase()
    return ['true', '1', 'sim', 'yes'].includes(normalized)
}

const acquireIdempotency = async (idempotencyRepository, key) => {
    if (!key) return true
    return idempotencyRepository.acquire(key, 5 * 60)
}

const sendDuplicate = (res) =>
    sendSuccess(res, 200, {
        message: 'duplicate_ignored',
        code: 'DUPLICATE_REQUEST',
    })

const registerMessagesRoute = ({ provider, handleCtx, context }) => {
    provider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const payload = req.body ?? {}
            const number = asText(payload.number)
            const message = asText(payload.message)
            const idempotencyKey = asText(payload.idempotencyKey)
            if (!number || !message) return sendError(res, 400, 'number and message are required', 'VALIDATION_ERROR')

            const accepted = await acquireIdempotency(context.repositories.idempotencyRepository, `message:${idempotencyKey}`)
            if (!accepted && idempotencyKey) return sendDuplicate(res)

            try {
                await retry(async () => bot.sendMessage(number, message, { media: payload.urlMedia ?? null }), {
                    attempts: 3,
                    delayMs: 500,
                })
                return sendSuccess(res, 200, { message: 'sent' })
            } catch (error) {
                console.error('[POST /v1/messages] Error sending message:', error)
                return sendError(res, 503, 'failed to deliver after retries', 'DELIVERY_FAILED', {
                    fallback: 'manual_handoff_required',
                })
            }
        })
    )
}

const handleLeadIntake = async (context, req, res) => {
    const payload = req.body ?? {}
    const number = asText(payload.number)
    const name = asText(payload.name)
    const objective = asText(payload.objective)
    const preferredWindow = asText(payload.preferredWindow || 'nao informado')
    const consent = asBoolean(payload.consent)
    if (!number || !name || !objective) return sendError(res, 400, 'number, name and objective are required', 'VALIDATION_ERROR')
    if (!consent) return sendError(res, 422, 'consent is required', 'CONSENT_REQUIRED')

    try {
        const intake = await context.useCases.qualifyLeadUseCase.execute({
            phoneNumber: number,
            name,
            objective,
            preferredWindow,
            consent: true,
            source: 'api',
            scorecard: payload.scorecard ?? {},
            conversationId: asText(payload.conversationId) || null,
        })

        return sendSuccess(res, 201, {
            leadId: intake.lead.id,
            temperature: intake.lead.temperature,
            qualificationScore: intake.lead.qualificationScore,
            nextAction: intake.nextAction,
            risk: intake.risk,
        })
    } catch (error) {
        console.error('[POST /v1/lead/intake] Error creating intake:', error)
        return sendError(res, 422, error.message, 'INTAKE_FAILED')
    }
}

const registerIntakeRoute = ({ provider, handleCtx, context }) => {
    provider.server.post('/v1/lead/intake', handleCtx(async (_bot, req, res) => handleLeadIntake(context, req, res)))
}

const registerHandoffRoute = ({ provider, handleCtx, context, env }) => {
    provider.server.post(
        '/v1/lead/handoff',
        handleCtx(async (_bot, req, res) => {
            const payload = req.body ?? {}
            const leadId = asText(payload.leadId) || null
            const phoneNumber = asText(payload.number) || null
            const reason = asText(payload.reason) || 'solicitacao_manual_api'
            const targetNumber = asText(payload.targetNumber) || null
            const idempotencyKey = asText(payload.idempotencyKey)

            if (!leadId && !phoneNumber) return sendError(res, 400, 'leadId or number is required', 'VALIDATION_ERROR')

            const accepted = await acquireIdempotency(context.repositories.idempotencyRepository, `handoff:${idempotencyKey}`)
            if (!accepted && idempotencyKey) return sendDuplicate(res)

            try {
                const handoff = await context.useCases.dispatchHandoffUseCase.execute({
                    leadId,
                    phoneNumber,
                    reason,
                    requestedBy: 'api',
                    targetNumber,
                })

                return sendSuccess(res, 200, {
                    leadId: handoff.lead?.id ?? leadId ?? null,
                    handoffId: handoff.handoff.handoffId,
                    dispatchedAt: handoff.handoff.dispatchedAt,
                    targetNumber: handoff.handoff.targetNumber ?? targetNumber ?? env.handoffWhatsappNumber,
                })
            } catch (error) {
                console.error('[POST /v1/lead/handoff] Error forwarding lead:', error)
                return sendError(res, 404, error.message, 'HANDOFF_FAILED')
            }
        })
    )
}

const registerHealthRoute = ({ provider, handleCtx, env }) => {
    provider.server.get(
        '/health',
        handleCtx(async (_bot, _req, res) =>
            sendSuccess(res, 200, {
                service: 'chatbot-clinica-estetica',
                uptimeSeconds: Math.floor(process.uptime()),
                channelMode: env.channelMode,
            })
        )
    )
}

export const registerCoreRoutes = ({ provider, handleCtx, context, env }) => {
    registerMessagesRoute({ provider, handleCtx, context })
    registerIntakeRoute({ provider, handleCtx, context })
    registerHandoffRoute({ provider, handleCtx, context, env })
    registerHealthRoute({ provider, handleCtx, env })
}
