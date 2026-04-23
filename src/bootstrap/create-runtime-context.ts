import { CaptureLeadFieldUseCase } from '../application/use-cases/capture-lead-field.use-case.ts'
import { DispatchHandoffUseCase } from '../application/use-cases/dispatch-handoff.use-case.ts'
import { EvaluateRiskUseCase } from '../application/use-cases/evaluate-risk.use-case.ts'
import { HandoffLeadUseCase } from '../application/use-cases/handoff-lead.use-case.ts'
import { IntakeLeadUseCase } from '../application/use-cases/intake-lead.use-case.ts'
import { QualifyLeadUseCase } from '../application/use-cases/qualify-lead.use-case.ts'
import { StartOrResumeConversationUseCase } from '../application/use-cases/start-or-resume-conversation.use-case.ts'
import { SandboxConversationService } from '../application/services/sandbox-conversation.service.ts'
import { CHANNEL_MODE } from '../config/env.ts'
import { ConversationPolicyService } from '../domain/services/conversation-policy.service.ts'
import { LeadQualificationService } from '../domain/services/lead-qualification.service.ts'
import { SafetyGuardService } from '../domain/services/safety-guard.service.ts'
import { HeuristicAiAssistant } from '../infrastructure/ai/heuristic-ai-assistant.ts'
import { ConsoleHandoffGateway } from '../infrastructure/handoff/console-handoff.gateway.ts'
import { InMemoryHandoffGateway } from '../infrastructure/handoff/in-memory-handoff.gateway.ts'
import { buildPostgresPool, ensureLeadTable } from '../infrastructure/persistence/postgres-client.ts'
import { buildRedisClient } from '../infrastructure/persistence/redis-client.ts'
import { InMemoryIdempotencyRepository } from '../infrastructure/repositories/in-memory-idempotency.repository.ts'
import { InMemoryLeadRepository } from '../infrastructure/repositories/in-memory-lead.repository.ts'
import { InMemorySessionRepository } from '../infrastructure/repositories/in-memory-session.repository.ts'
import { PostgresLeadRepository } from '../infrastructure/repositories/postgres-lead.repository.ts'
import { RedisIdempotencyRepository } from '../infrastructure/repositories/redis-idempotency.repository.ts'
import { RedisSessionRepository } from '../infrastructure/repositories/redis-session.repository.ts'

const createLeadRepository = async (env) => {
    if (!env.databaseUrl) return new InMemoryLeadRepository()

    try {
        const postgresPool = await buildPostgresPool({
            databaseUrl: env.databaseUrl,
            databaseSslMode: env.databaseSslMode,
            databaseSslRejectUnauthorized: env.databaseSslRejectUnauthorized,
            databaseSslCa: env.databaseSslCa,
        })
        await ensureLeadTable(postgresPool)
        return new PostgresLeadRepository({ pool: postgresPool })
    } catch (error) {
        console.error('[runtime] postgres unavailable, using in-memory lead repository:', error?.message ?? error)
        return new InMemoryLeadRepository()
    }
}

const createSessionAndIdempotencyRepositories = async (env) => {
    if (!env.redisUrl) {
        return {
            sessionRepository: new InMemorySessionRepository(),
            idempotencyRepository: new InMemoryIdempotencyRepository(),
        }
    }

    try {
        const redisClient = await buildRedisClient(env.redisUrl)
        return {
            sessionRepository: new RedisSessionRepository({ client: redisClient }),
            idempotencyRepository: new RedisIdempotencyRepository({ client: redisClient }),
        }
    } catch (error) {
        console.error('[runtime] redis unavailable, using in-memory session/idempotency:', error?.message ?? error)
        return {
            sessionRepository: new InMemorySessionRepository(),
            idempotencyRepository: new InMemoryIdempotencyRepository(),
        }
    }
}

const createHandoffGateway = (env) => {
    if (env.channelMode === CHANNEL_MODE.SANDBOX) {
        return new InMemoryHandoffGateway({
            targetNumber: env.handoffWhatsappNumber,
        })
    }

    return new ConsoleHandoffGateway({
        targetNumber: env.handoffWhatsappNumber,
    })
}

const createDomainServices = () => ({
    aiAssistant: new HeuristicAiAssistant(),
    safetyGuardService: new SafetyGuardService(),
    leadQualificationService: new LeadQualificationService(),
    conversationPolicyService: new ConversationPolicyService(),
})

const createUseCases = ({ leadRepository, handoffGateway, sessionRepository, services }) => {
    const intakeLeadUseCase = new IntakeLeadUseCase({
        leadRepository,
        aiAssistant: services.aiAssistant,
        safetyGuardService: services.safetyGuardService,
        leadQualificationService: services.leadQualificationService,
    })

    const handoffLeadUseCase = new HandoffLeadUseCase({ leadRepository, handoffGateway })

    const qualifyLeadUseCase = new QualifyLeadUseCase({
        leadRepository,
        aiAssistant: services.aiAssistant,
        safetyGuardService: services.safetyGuardService,
        leadQualificationService: services.leadQualificationService,
    })

    const dispatchHandoffUseCase = new DispatchHandoffUseCase({ leadRepository, handoffGateway })
    const evaluateRiskUseCase = new EvaluateRiskUseCase({ safetyGuardService: services.safetyGuardService })
    const startConversationUseCase = new StartOrResumeConversationUseCase({ sessionRepository })
    const captureLeadFieldUseCase = new CaptureLeadFieldUseCase({ sessionRepository })

    return {
        intakeLeadUseCase,
        handoffLeadUseCase,
        qualifyLeadUseCase,
        dispatchHandoffUseCase,
        evaluateRiskUseCase,
        startConversationUseCase,
        captureLeadFieldUseCase,
    }
}

const createSandboxService = ({ useCases, sessionRepository, conversationPolicyService }) =>
    new SandboxConversationService({
        startConversationUseCase: useCases.startConversationUseCase,
        captureLeadFieldUseCase: useCases.captureLeadFieldUseCase,
        qualifyLeadUseCase: useCases.qualifyLeadUseCase,
        dispatchHandoffUseCase: useCases.dispatchHandoffUseCase,
        evaluateRiskUseCase: useCases.evaluateRiskUseCase,
        sessionRepository,
        policyService: conversationPolicyService,
    })

export const createRuntimeContext = async (env) => {
    const leadRepository = await createLeadRepository(env)
    const { sessionRepository, idempotencyRepository } = await createSessionAndIdempotencyRepositories(env)
    const handoffGateway = createHandoffGateway(env)
    const services = createDomainServices()
    const useCases = createUseCases({ leadRepository, handoffGateway, sessionRepository, services })
    const sandboxConversationService = createSandboxService({
        useCases,
        sessionRepository,
        conversationPolicyService: services.conversationPolicyService,
    })

    return {
        repositories: {
            leadRepository,
            sessionRepository,
            idempotencyRepository,
        },
        services: {
            safetyGuardService: services.safetyGuardService,
            conversationPolicyService: services.conversationPolicyService,
            sandboxConversationService,
        },
        gateways: {
            handoffGateway,
        },
        useCases: {
            intakeLeadUseCase: useCases.intakeLeadUseCase,
            handoffLeadUseCase: useCases.handoffLeadUseCase,
            qualifyLeadUseCase: useCases.qualifyLeadUseCase,
            dispatchHandoffUseCase: useCases.dispatchHandoffUseCase,
        },
    }
}
