import test from 'node:test'
import assert from 'node:assert/strict'

import { LeadQualificationService } from '../../src/domain/services/lead-qualification.service'

test('classifica lead quente com consentimento e urgencia alta', () => {
    const service = new LeadQualificationService()

    const result = service.scoreLead({
        consent: true,
        preferredWindow: 'amanha as 14:00',
        aiAssessment: {
            urgency: 'alta',
            interest: 'toxina_botulinica',
            objectionTag: 'nenhuma',
        },
        risk: {
            highRisk: false,
        },
    })

    assert.equal(result.temperature, 'quente')
    assert.ok(result.score >= 70)
})

test('forca lead frio quando existe sinal de risco', () => {
    const service = new LeadQualificationService()

    const result = service.scoreLead({
        consent: true,
        preferredWindow: 'hoje',
        aiAssessment: {
            urgency: 'alta',
            interest: 'preenchimento',
            objectionTag: 'nenhuma',
        },
        risk: {
            highRisk: true,
        },
    })

    assert.equal(result.temperature, 'frio')
    assert.equal(result.score, 5)
})
