import assert from 'node:assert/strict'
import test from 'node:test'

import { CaptureLeadFieldUseCase } from '../../src/application/use-cases/capture-lead-field.use-case.ts'
import { DispatchHandoffUseCase } from '../../src/application/use-cases/dispatch-handoff.use-case.ts'
import { EvaluateRiskUseCase } from '../../src/application/use-cases/evaluate-risk.use-case.ts'
import { QualifyLeadUseCase } from '../../src/application/use-cases/qualify-lead.use-case.ts'
import { StartOrResumeConversationUseCase } from '../../src/application/use-cases/start-or-resume-conversation.use-case.ts'
import { SandboxConversationService } from '../../src/application/services/sandbox-conversation.service.ts'
import { ConversationPolicyService } from '../../src/domain/services/conversation-policy.service.ts'
import { LeadQualificationService } from '../../src/domain/services/lead-qualification.service.ts'
import { SafetyGuardService } from '../../src/domain/services/safety-guard.service.ts'
import { HeuristicAiAssistant } from '../../src/infrastructure/ai/heuristic-ai-assistant.ts'
import { InMemoryHandoffGateway } from '../../src/infrastructure/handoff/in-memory-handoff.gateway.ts'
import { InMemoryLeadRepository } from '../../src/infrastructure/repositories/in-memory-lead.repository.ts'
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository.ts'

const createSandboxService = () => {
    const leadRepository = new InMemoryLeadRepository()
    const sessionRepository = new InMemorySessionRepository()
    const handoffGateway = new InMemoryHandoffGateway({ targetNumber: '5565981506458' })

    const aiAssistant = new HeuristicAiAssistant()
    const safetyGuardService = new SafetyGuardService()
    const leadQualificationService = new LeadQualificationService()
    const conversationPolicyService = new ConversationPolicyService()

    const startConversationUseCase = new StartOrResumeConversationUseCase({ sessionRepository })
    const captureLeadFieldUseCase = new CaptureLeadFieldUseCase({ sessionRepository })
    const qualifyLeadUseCase = new QualifyLeadUseCase({
        leadRepository,
        aiAssistant,
        safetyGuardService,
        leadQualificationService,
    })
    const dispatchHandoffUseCase = new DispatchHandoffUseCase({
        leadRepository,
        handoffGateway,
    })
    const evaluateRiskUseCase = new EvaluateRiskUseCase({ safetyGuardService })

    const service = new SandboxConversationService({
        startConversationUseCase,
        captureLeadFieldUseCase,
        qualifyLeadUseCase,
        dispatchHandoffUseCase,
        evaluateRiskUseCase,
        sessionRepository,
        policyService: conversationPolicyService,
    })

    return {
        service,
        repositories: {
            leadRepository,
            sessionRepository,
        },
    }
}

test('fluxo feliz em sandbox conclui com lead e sessao fechada', async () => {
    const { service, repositories } = createSandboxService()
    const from = '5565999999999'

    await service.handleMessage({ from, message: 'oi' })
    await service.handleMessage({ from, message: 'sim' })
    await service.handleMessage({ from, message: 'Bruno' })
    await service.handleMessage({ from, message: 'Quero botox para rugas antes de um evento' })
    await service.handleMessage({ from, message: 'amanha' })
    await service.handleMessage({ from, message: 'preco' })
    await service.handleMessage({ from, message: 'noite' })
    await service.handleMessage({ from, message: 'sim' })
    const finalResponse = await service.handleMessage({ from, message: 'sim' })

    const allLeads = await repositories.leadRepository.listAll()
    const session = await repositories.sessionRepository.findByPhone(from)

    assert.equal(allLeads.length, 1)
    assert.equal(session.state, 'CLOSED')
    assert.equal(finalResponse.messages.length >= 2, true)
    assert.ok(finalResponse.lead?.id)
    assert.ok(finalResponse.handoff?.handoffId)
})

test('anti-loop encaminha para humano na terceira resposta invalida', async () => {
    const { service, repositories } = createSandboxService()
    const from = '5565988888888'

    await service.handleMessage({ from, message: 'oi' })
    await service.handleMessage({ from, message: 'talvez' })
    await service.handleMessage({ from, message: 'depende' })
    const finalResponse = await service.handleMessage({ from, message: 'quasar' })
    const session = await repositories.sessionRepository.findByPhone(from)

    assert.equal(session.state, 'CLOSED')
    assert.equal(finalResponse.messages.some((message) => message.includes('atendimento humano')), true)
})

test('objetivo com risco clinico dispara handoff imediato', async () => {
    const { service, repositories } = createSandboxService()
    const from = '5565977777777'

    await service.handleMessage({ from, message: 'oi' })
    await service.handleMessage({ from, message: 'sim' })
    await service.handleMessage({ from, message: 'Paciente Teste' })
    const riskResponse = await service.handleMessage({
        from,
        message: 'Estou com dor intensa e sangramento apos procedimento',
    })

    const leads = await repositories.leadRepository.listAll()
    const session = await repositories.sessionRepository.findByPhone(from)

    assert.equal(leads.length, 0)
    assert.equal(session.state, 'CLOSED')
    assert.equal(riskResponse.messages.some((message) => message.includes('seguranca')), true)
})
