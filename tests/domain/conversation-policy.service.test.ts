import assert from 'node:assert/strict'
import test from 'node:test'

import { CONVERSATION_STATE } from '../../src/domain/entities/conversation-session.ts'
import { ConversationPolicyService } from '../../src/domain/services/conversation-policy.service.ts'

test('parse de sim/nao funciona com variacoes', () => {
    const service = new ConversationPolicyService()

    assert.equal(service.parseYesNo('sim'), true)
    assert.equal(service.parseYesNo('autorizo'), true)
    assert.equal(service.parseYesNo('nao'), false)
    assert.equal(service.parseYesNo('prefiro nao'), false)
    assert.equal(service.parseYesNo('talvez'), null)
})

test('valida urgencia e objecao para scorecard', () => {
    const service = new ConversationPolicyService()

    const urgency = service.validateForState(CONVERSATION_STATE.SCORECARD_URGENCY, 'quero hoje')
    const objection = service.validateForState(CONVERSATION_STATE.SCORECARD_OBJECTION, 'minha duvida e preco')

    assert.equal(urgency.valid, true)
    assert.equal(urgency.value, 'alta')
    assert.equal(objection.valid, true)
    assert.equal(objection.value, 'preco')
})

test('regra anti-loop ativa na terceira tentativa invalida', () => {
    const service = new ConversationPolicyService({ maxInvalidAttempts: 2 })
    assert.equal(service.isMaxInvalidAttemptsReached(1), false)
    assert.equal(service.isMaxInvalidAttemptsReached(2), false)
    assert.equal(service.isMaxInvalidAttemptsReached(3), true)
})
