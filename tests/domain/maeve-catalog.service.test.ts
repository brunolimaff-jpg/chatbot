import test from 'node:test'
import assert from 'node:assert/strict'

import { MaeveCatalogService } from '../../src/domain/services/maeve-catalog.service.ts'

test('responde catalogo da Maeve sem inventar servicos', () => {
    const service = new MaeveCatalogService()
    const answer = service.buildServicesAnswer()

    assert.match(answer, /Depilacao a Laser/)
    assert.match(answer, /Drenagem Linfatica/)
    assert.match(answer, /Protocolo Personalizado Maeve/)
    assert.doesNotMatch(answer, /preenchimento labial/i)
    assert.doesNotMatch(answer, /botox/i)
    assert.doesNotMatch(answer, /Hakon|Criodermis|Ultra-K|Ibramed|Effect/i)
})

test('responde preco como passagem acolhedora para humano sem tabela fria', () => {
    const service = new MaeveCatalogService()
    const answer = service.buildPriceAnswer()

    assert.match(answer, /depende/i)
    assert.match(answer, /equipe/i)
    assert.match(answer, /continuar/i)
    assert.doesNotMatch(answer, /R\$ ?200/i)
    assert.doesNotMatch(answer, /R\$ ?3000/i)
})

test('mantem tecnologias como conhecimento interno vinculado aos servicos', () => {
    const service = new MaeveCatalogService()
    const technologies = service.listTechnologies()

    assert.ok(technologies.length >= 7)
    assert.ok(technologies.every((technology) => technology.publicName))
    assert.ok(technologies.every((technology) => technology.internalModel))
    assert.ok(technologies.every((technology) => technology.brand))
    assert.ok(technologies.every((technology) => technology.plainUse))
    assert.ok(technologies.every((technology) => technology.clientFriendlyBenefits.length))
    assert.ok(technologies.every((technology) => technology.relatedServices.length))
    assert.ok(technologies.every((technology) => technology.aliases.length))
    assert.ok(technologies.every((technology) => technology.whenToMention))
    assert.ok(technologies.every((technology) => technology.avoidClaims.length))
    assert.ok(technologies.every((technology) => technology.safetyNotes.length))

    assert.ok(technologies.some((technology) => technology.id === 'hakon_laser' && technology.relatedServices.includes('depilacao_laser')))
    assert.ok(technologies.some((technology) => technology.id === 'dermosteam' && technology.relatedServices.includes('limpeza_pele')))
    assert.ok(technologies.some((technology) => technology.id === 'hf_ibramed' && technology.relatedServices.includes('limpeza_pele')))
    assert.ok(
        technologies.some(
            (technology) =>
                technology.id === 'criodermis_smart' &&
                technology.relatedServices.includes('protocolo_personalizado_maeve')
        )
    )
})

test('resolve tecnologias por objetivo sem depender de nome tecnico', () => {
    const service = new MaeveCatalogService()

    const bodyContext = service.resolveTechnologyContext('quero tratar gordura localizada e flacidez no abdomen')
    assert.match(bodyContext.summary, /protocolo corporal/i)
    assert.deepEqual(
        bodyContext.technologies.map((technology) => technology.id),
        ['ultra_k', 'criodermis_smart', 'effect_radiofrequencia']
    )

    const skinContext = service.resolveTechnologyContext('preciso de limpeza de pele com acne')
    assert.deepEqual(
        skinContext.technologies.map((technology) => technology.id),
        ['dermosteam', 'hf_ibramed']
    )
})
