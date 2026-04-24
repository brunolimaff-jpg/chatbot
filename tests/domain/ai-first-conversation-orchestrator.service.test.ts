import test from 'node:test'
import assert from 'node:assert/strict'

import { AiFirstConversationOrchestratorService } from '../../src/domain/services/ai-first-conversation-orchestrator.service.ts'
import { MaeveCatalogService } from '../../src/domain/services/maeve-catalog.service.ts'
import { SafetyGuardService } from '../../src/domain/services/safety-guard.service.ts'

const createService = () =>
    new AiFirstConversationOrchestratorService({
        aiAssistant: {
            async planConversationTurn() {
                return {}
            },
        },
        catalogService: new MaeveCatalogService(),
        safetyGuardService: new SafetyGuardService(),
    })

test('fallback usa abertura amiga consultiva em vez de tom institucional', () => {
    const service = createService()

    const decision = service.fallbackDecision('oi')

    assert.match(decision.reply, /seja bem-vinda/i)
    assert.match(decision.reply, /😊✨/)
    assert.match(decision.reply, /Maêve/)
    assert.match(decision.reply, /me conta/i)
    assert.doesNotMatch(decision.reply, /assistente virtual/i)
    assert.doesNotMatch(decision.reply, /dar continuidade ao atendimento com todo o cuidado/i)
})

test('sanitiza preco fixo com resposta comercial leve e sem tabela fria', () => {
    const service = createService()

    const decision = service.normalizeDecision({
        intent: 'price_question',
        reply: 'Custa R$ 250,00.',
        nextState: 'READY_FOR_HANDOFF',
        handoff: { recommended: true, reason: 'duvida_preco', priority: 'normal' },
    })

    assert.doesNotMatch(decision.reply, /R\$/)
    assert.match(decision.reply, /💛/)
    assert.match(decision.reply, /sem compromisso/i)
    assert.match(decision.reply, /faz sentido para você/i)
})
