import test from 'node:test'
import assert from 'node:assert/strict'

import { SafetyGuardService } from '../../src/domain/services/safety-guard.service'

test('detecta termos de alto risco e recomenda handoff imediato', () => {
    const service = new SafetyGuardService()
    const result = service.evaluateText('Estou com dor intensa e sangramento apos o procedimento')

    assert.equal(result.highRisk, true)
    assert.equal(result.recommendedAction, 'encaminhar_humano_imediato')
})

test('detecta pedido de diagnostico e limita resposta clinica', () => {
    const service = new SafetyGuardService()
    const result = service.evaluateText('Pode fazer um diagnostico e falar qual remedio usar?')

    assert.equal(result.diagnosisRequest, true)
    assert.equal(result.recommendedAction, 'responder_limite_clinico')
})
