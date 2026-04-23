import { createBot, createProvider, MemoryDB as Database, TestTool } from '@builderbot/bot'
import { BaileysProvider as WhatsAppProvider } from '@builderbot/provider-baileys'

import { createRuntimeContext } from './bootstrap/create-runtime-context.ts'
import { CHANNEL_MODE, loadEnv } from './config/env.ts'
import { buildSandboxNoopFlow } from './flows/sandbox-noop-flow.ts'
import { buildWhatsAppFlow } from './flows/whatsapp-flow.ts'
import { registerCoreRoutes } from './http/register-core-routes.ts'
import { registerSandboxRoutes } from './http/register-sandbox-routes.ts'

const createProviderByMode = (env) => {
    if (env.channelMode === CHANNEL_MODE.SANDBOX) {
        return createProvider(TestTool.TestProvider, { name: 'sandbox' })
    }

    return createProvider(WhatsAppProvider, {
        version: [2, 3000, 1035824857],
        usePairingCode: env.whatsappUsePairingCode,
        phoneNumber: env.whatsappPairingPhone,
    })
}

const createFlowByMode = (env, context) => {
    if (env.channelMode === CHANNEL_MODE.SANDBOX) {
        return buildSandboxNoopFlow()
    }

    return buildWhatsAppFlow({
        intakeLeadUseCase: context.useCases.intakeLeadUseCase,
        handoffLeadUseCase: context.useCases.handoffLeadUseCase,
        safetyGuardService: context.services.safetyGuardService,
        conversationPolicyService: context.services.conversationPolicyService,
    })
}

const main = async () => {
    const env = loadEnv()
    const context = await createRuntimeContext(env)

    const provider = createProviderByMode(env)
    const flow = createFlowByMode(env, context)
    const database = new Database()

    if (env.channelMode === CHANNEL_MODE.WHATSAPP && typeof context.gateways.handoffGateway.setProvider === 'function') {
        context.gateways.handoffGateway.setProvider(provider)
    }

    const { handleCtx, httpServer } = await createBot({
        flow,
        provider,
        database,
    })

    registerCoreRoutes({ provider, handleCtx, context, env })
    registerSandboxRoutes({ provider, handleCtx, context, env })

    httpServer(Number(env.port))
}

main()
