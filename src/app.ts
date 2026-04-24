import 'dotenv/config'

import { createBot, createProvider, MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as WhatsAppProvider } from '@builderbot/provider-baileys'

import { createRuntimeContext } from './bootstrap/create-runtime-context.ts'
import { CHANNEL_MODE, loadEnv } from './config/env.ts'
import { buildSandboxNoopFlow } from './flows/sandbox-noop-flow.ts'
import { buildWhatsAppFlow } from './flows/whatsapp-flow.ts'
import { registerCoreRoutes } from './http/register-core-routes.ts'
import { registerSandboxRoutes } from './http/register-sandbox-routes.ts'
import { SandboxProvider } from './infrastructure/providers/sandbox.provider.ts'

const createProviderByMode = (env) => {
    if (env.channelMode === CHANNEL_MODE.SANDBOX) {
        return createProvider(SandboxProvider, { name: 'sandbox' })
    }

    const options = env.whatsappProtocolVersion ? { version: env.whatsappProtocolVersion } : {}
    if (env.whatsappUsePairingCode && env.whatsappPairingPhone) {
        options.usePairingCode = true
        options.phoneNumber = env.whatsappPairingPhone
    }

    return createProvider(WhatsAppProvider, options)
}

const buildFlowByMode = (env, context) => {
    if (env.channelMode === CHANNEL_MODE.SANDBOX) return buildSandboxNoopFlow()

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
    const flow = buildFlowByMode(env, context)
    const database = new Database()

    const { handleCtx, httpServer } = await createBot({ flow, provider, database })
    registerCoreRoutes({ provider, handleCtx, context, env })
    registerSandboxRoutes({ provider, handleCtx, context, env })
    httpServer(env.port)
}

main()
