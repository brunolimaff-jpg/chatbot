import test from 'node:test'
import assert from 'node:assert/strict'

import { SandboxConversationService } from '../../src/application/services/sandbox-conversation.service.ts'
import { CONVERSATION_STATE } from '../../src/domain/entities/conversation-session.ts'
import { InMemoryConversationRepository } from '../../src/infrastructure/repositories/in-memory-conversation.repository.ts'
import { InMemoryLeadRepository } from '../../src/infrastructure/repositories/in-memory-lead.repository.ts'
import { ConsoleHandoffGateway } from '../../src/infrastructure/handoff/console-handoff.gateway.ts'
import { IntakeLeadUseCase } from '../../src/application/use-cases/intake-lead.use-case.ts'
import { HandoffLeadUseCase } from '../../src/application/use-cases/handoff-lead.use-case.ts'
import { SafetyGuardService } from '../../src/domain/services/safety-guard.service.ts'
import { LeadQualificationService } from '../../src/domain/services/lead-qualification.service.ts'
import { MaeveCatalogService } from '../../src/domain/services/maeve-catalog.service.ts'
import { AiFirstConversationOrchestratorService } from '../../src/domain/services/ai-first-conversation-orchestrator.service.ts'
import { HeuristicAiAssistant } from '../../src/infrastructure/ai/heuristic-ai-assistant.ts'

const createFakeAi = (turns) => ({
    calls: [],
    async planConversationTurn(input) {
        this.calls.push(input)
        const next = turns.shift()
        if (next instanceof Error) throw next
        return next
    },
    async assessText(text) {
        return new HeuristicAiAssistant().assessText(text)
    },
})

const turn = (overrides) => ({
    intent: 'general_question',
    reply: 'Claro, posso te ajudar. Me conta o que voce busca melhorar ou cuidar hoje?',
    nextState: CONVERSATION_STATE.DISCOVERY,
    slots: {},
    handoff: { recommended: false, reason: null, priority: 'normal' },
    risk: { clinicalRisk: false, diagnosisRequest: false },
    confidence: 0.9,
    reasoningSummary: 'Turno conduzido pela IA.',
    source: 'gemini',
    modelUsed: 'models/gemini-3.1-flash-lite-preview',
    ...overrides,
})

const createService = (aiAssistant = createFakeAi([]), options = {}) => {
    const leadRepository = options.leadRepository ?? new InMemoryLeadRepository()
    const safetyGuardService = new SafetyGuardService()
    const catalogService = new MaeveCatalogService()
    const handoffGateway = options.handoffGateway ?? new ConsoleHandoffGateway()

    return new SandboxConversationService({
        conversationRepository: new InMemoryConversationRepository(),
        catalogService,
        orchestratorService: new AiFirstConversationOrchestratorService({ aiAssistant, catalogService, safetyGuardService }),
        safetyGuardService,
        intakeLeadUseCase: new IntakeLeadUseCase({
            leadRepository,
            aiAssistant,
            safetyGuardService,
            leadQualificationService: new LeadQualificationService(),
        }),
        handoffLeadUseCase: new HandoffLeadUseCase({ leadRepository, handoffGateway }),
    })
}

test('mensagem livre chama IA antes de regras locais de catalogo', async () => {
    const ai = createFakeAi([
        turn({
            intent: 'service_question',
            reply: 'Na Maeve, temos protocolos personalizados, depilacao a laser, massagens, limpeza de pele e dermaplaning. Qual cuidado combina com seu momento?',
            slots: { objective: 'conhecer servicos' },
        }),
    ])
    const service = createService(ai)
    const result = await service.handleMessage({
        from: '5565999111000',
        message: 'quais servicos voces fazem?',
    })

    assert.equal(ai.calls.length, 1)
    assert.equal(result.state, CONVERSATION_STATE.DISCOVERY)
    assert.equal(result.nlu.intent, 'service_question')
    assert.equal(result.nlu.source, 'gemini')
    assert.match(result.messages.join('\n'), /protocolos personalizados/i)
})

test('recusa de informar nome nao vira nome do lead nem negacao da jornada', async () => {
    const ai = createFakeAi([
        turn({
            intent: 'name_refusal',
            reply: 'Sem problema, podemos seguir sem seu nome por enquanto. Me conta qual cuidado voce procura hoje?',
            slots: { name: null },
        }),
    ])
    const service = createService(ai)

    const result = await service.handleMessage({ from: '5565999555000', message: 'nao quero falar o nome' })

    assert.equal(result.state, CONVERSATION_STATE.DISCOVERY)
    assert.equal(result.nlu.intent, 'name_refusal')
    assert.equal(result.session.leadDraft.name, null)
    assert.match(result.messages.join('\n'), /Sem problema/i)
})

test('pergunta de preco com lead qualificado gera passagem humana acolhedora', async () => {
    const ai = createFakeAi([
        turn({
            intent: 'price_question',
            reply: 'O valor depende da avaliacao e do protocolo mais adequado para voce. Vou deixar sua conversa encaminhada para a equipe te orientar com cuidado.',
            nextState: CONVERSATION_STATE.READY_FOR_HANDOFF,
            slots: { objective: 'limpeza de pele', service: 'limpeza_pele', objection: 'preco', budgetConcern: true },
            handoff: { recommended: true, reason: 'duvida_preco', priority: 'normal' },
        }),
    ])
    const service = createService(ai)
    const result = await service.handleMessage({ from: '5565999222000', message: 'quanto custa?' })

    assert.equal(result.state, CONVERSATION_STATE.READY_FOR_HANDOFF)
    assert.equal(result.nlu.intent, 'price_question')
    assert.equal(result.nlu.handoff.recommended, true)
    assert.ok(result.leadId)
    assert.ok(result.handoffId)
    assert.match(result.messages.join('\n'), /equipe/i)
    assert.doesNotMatch(result.messages.join('\n'), /R\$/)
})

test('segura handoff de preco quando faltam objetivo e servico', async () => {
    const ai = createFakeAi([
        turn({
            intent: 'price_question',
            reply: 'Entendi. Pra te orientar melhor: voce tem uma faixa em mente ou prefere que a equipe te mostre as opcoes mais acessiveis primeiro?',
            nextState: CONVERSATION_STATE.READY_FOR_HANDOFF,
            slots: { objection: 'price', budgetConcern: true, qualificationMissing: ['objective', 'service'] },
            handoff: { recommended: true, reason: 'duvida_preco', priority: 'normal' },
        }),
    ])
    const service = createService(ai)

    const result = await service.handleMessage({ from: '5565999001000', message: 'dinheiro' })

    assert.equal(result.state, CONVERSATION_STATE.QUALIFYING)
    assert.equal(result.leadId, null)
    assert.equal(result.handoffId, null)
    assert.equal(result.nlu.handoff.recommended, false)
    assert.equal(result.session.leadDraft.objection, 'price')
    assert.equal(result.session.leadDraft.budgetConcern, true)
    assert.match(result.messages.join('\n'), /faixa em mente|opcoes mais acessiveis/i)
})

test('reconhece fototipo e pergunta caminho sem diagnosticar', async () => {
    const ai = createFakeAi([
        turn({
            intent: 'service_question',
            reply: 'Isso importa sim pra escolher com mais seguranca. Voce esta pensando em laser, pele ou outro cuidado?',
            nextState: CONVERSATION_STATE.QUALIFYING,
            slots: { skinToneOrPhototype: 'pele negra', qualificationMissing: ['service', 'objective'] },
            handoff: { recommended: false, reason: null, priority: 'normal' },
        }),
    ])
    const service = createService(ai)

    const result = await service.handleMessage({
        from: '5565999002000',
        message: 'me fale sobre os procedimentos, eu sou negra',
    })

    assert.equal(result.state, CONVERSATION_STATE.QUALIFYING)
    assert.equal(result.session.leadDraft.skinToneOrPhototype, 'pele negra')
    assert.equal(result.leadId, null)
    assert.match(result.messages.join('\n'), /seguranca/i)
    assert.match(result.messages.join('\n'), /laser|pele|cuidado/i)
    assert.doesNotMatch(result.messages.join('\n'), /garantido|sem risco/i)
})

test('cruza drenagem com objetivo de emagrecer e alinha expectativa antes de handoff', async () => {
    const ai = createFakeAi([
        turn({
            intent: 'service_interest',
            reply: 'A drenagem pode ajudar na sensacao de leveza e inchaco, mas nao e tratamento de emagrecimento sozinha. Quer que a equipe veja um protocolo mais completo pra esse objetivo?',
            nextState: CONVERSATION_STATE.QUALIFYING,
            slots: {
                service: 'drenagem',
                objective: 'emagrecimento',
                expectationRisk: 'drenagem_nao_emagrece_sozinha',
            },
            handoff: { recommended: false, reason: null, priority: 'normal' },
        }),
    ])
    const service = createService(ai)

    const result = await service.handleMessage({ from: '5565999003000', message: 'drenagem, meu objetivo e emagrecer' })

    assert.equal(result.state, CONVERSATION_STATE.QUALIFYING)
    assert.equal(result.session.leadDraft.service, 'drenagem')
    assert.equal(result.session.leadDraft.objective, 'emagrecimento')
    assert.equal(result.session.leadDraft.expectationRisk, 'drenagem_nao_emagrece_sozinha')
    assert.equal(result.leadId, null)
    assert.match(result.messages.join('\n'), /nao e tratamento de emagrecimento sozinha/i)
})

test('pode chamar cria handoff quando lead ja tem qualificacao minima', async () => {
    const ai = createFakeAi([
        turn({
            intent: 'service_interest',
            reply: 'Boa, ja entendi: drenagem para objetivo de emagrecimento, com foco em leveza e inchaco. Posso deixar com a equipe?',
            nextState: CONVERSATION_STATE.QUALIFYING,
            slots: {
                service: 'drenagem',
                objective: 'emagrecimento',
                expectationRisk: 'drenagem_nao_emagrece_sozinha',
            },
            handoff: { recommended: false, reason: null, priority: 'normal' },
        }),
        turn({
            intent: 'human_request',
            reply: 'Perfeito, vou deixar encaminhado pra equipe te chamar por aqui.',
            nextState: CONVERSATION_STATE.READY_FOR_HANDOFF,
            slots: {},
            handoff: { recommended: true, reason: 'usuario_autorizou_handoff', priority: 'normal' },
        }),
    ])
    const service = createService(ai)

    await service.handleMessage({ from: '5565999004000', message: 'drenagem, meu objetivo e emagrecer' })
    const result = await service.handleMessage({ from: '5565999004000', message: 'pode chamar' })

    assert.equal(result.state, CONVERSATION_STATE.READY_FOR_HANDOFF)
    assert.ok(result.leadId)
    assert.ok(result.handoffId)
    assert.equal(result.session.leadDraft.service, 'drenagem')
    assert.equal(result.session.leadDraft.objective, 'emagrecimento')
    assert.equal(result.session.leadDraft.expectationRisk, 'drenagem_nao_emagrece_sozinha')
})

test('intencao de avaliacao gera handoff sem exigir nome telefone ou consentimento', async () => {
    const ai = createFakeAi([
        turn({
            intent: 'schedule_interest',
            reply: 'Posso deixar seu pedido de avaliacao encaminhado para a equipe Maeve continuar com voce por aqui.',
            nextState: CONVERSATION_STATE.READY_FOR_HANDOFF,
            slots: { objective: 'avaliacao personalizada', preferredWindow: 'nao informado' },
            handoff: { recommended: true, reason: 'avaliacao_solicitada', priority: 'normal' },
        }),
    ])
    const service = createService(ai)

    const result = await service.handleMessage({ from: '5565999333000', message: 'quero uma avaliacao' })

    assert.equal(result.state, CONVERSATION_STATE.READY_FOR_HANDOFF)
    assert.ok(result.leadId)
    assert.ok(result.handoffId)
    assert.equal(result.session.leadDraft.name, null)
    assert.equal(result.session.leadDraft.objective, 'avaliacao personalizada')
})

test('sinal clinico de risco encaminha humano com prioridade', async () => {
    const ai = createFakeAi([])
    const service = createService(ai)

    const result = await service.handleMessage({ from: '5565999444000', message: 'estou com dor intensa e febre' })

    assert.equal(ai.calls.length, 0)
    assert.equal(result.state, CONVERSATION_STATE.CLOSED)
    assert.equal(result.nlu.intent, 'clinical_risk')
    assert.equal(result.nlu.handoff.recommended, true)
    assert.match(result.messages.join('\n'), /atendimento humano/i)
    assert.doesNotMatch(result.messages.join('\n'), /[😊✨🌿💛✅⚠️⏰]/u)
})

test('pergunta de localizacao usa Jardim Imperial e oferece pin sem inventar rota', async () => {
    const ai = createFakeAi([
        turn({
            intent: 'location_question',
            reply: 'A Maeve fica no Jardim Imperial, em Cuiaba. Posso pedir pra equipe te mandar o pin certinho por aqui?',
            nextState: CONVERSATION_STATE.DISCOVERY,
            slots: { territoryHint: 'Jardim Imperial, Cuiaba' },
            handoff: { recommended: false, reason: null, priority: 'normal' },
        }),
    ])
    const service = createService(ai)

    const result = await service.handleMessage({ from: '5565999005000', message: 'onde fica?' })

    assert.equal(result.nlu.intent, 'location_question')
    assert.equal(result.session.leadDraft.territoryHint, 'Jardim Imperial, Cuiaba')
    assert.match(result.messages.join('\n'), /Jardim Imperial/i)
    assert.match(result.messages.join('\n'), /pin/i)
    assert.doesNotMatch(result.messages.join('\n'), /minutos|estacionamento|vaga/i)
})

test('objecao territorial registra bairro/regiao sem encaminhar lead cru', async () => {
    const ai = createFakeAi([
        turn({
            intent: 'general_question',
            reply: 'Entendi. A Maeve fica no Jardim Imperial, em Cuiaba. Me conta qual cuidado voce quer fazer pra eu ver se faz sentido deixar uma avaliacao encaminhada?',
            nextState: CONVERSATION_STATE.QUALIFYING,
            slots: { territoryHint: 'mora longe', userNeighborhood: 'CPA', qualificationMissing: ['objective', 'service'] },
            handoff: { recommended: false, reason: null, priority: 'normal' },
        }),
    ])
    const service = createService(ai)

    const result = await service.handleMessage({ from: '5565999006000', message: 'moro longe no CPA' })

    assert.equal(result.state, CONVERSATION_STATE.QUALIFYING)
    assert.equal(result.leadId, null)
    assert.equal(result.session.leadDraft.territoryHint, 'mora longe')
    assert.equal(result.session.leadDraft.userNeighborhood, 'CPA')
    assert.match(result.messages.join('\n'), /Jardim Imperial/i)
})

test('preserva origem de anuncio/referral no draft da sessao', async () => {
    const ai = createFakeAi([
        turn({
            intent: 'service_interest',
            reply: 'Vi que voce veio pelo anuncio de laser. Me conta qual area voce pensa em cuidar?',
            nextState: CONVERSATION_STATE.QUALIFYING,
            slots: { service: 'depilacao_laser', objective: 'depilacao a laser', qualificationMissing: ['useful_detail'] },
            handoff: { recommended: false, reason: null, priority: 'normal' },
        }),
    ])
    const service = createService(ai)

    const result = await service.handleMessage({
        from: '5565999007000',
        message: 'vi o anuncio de laser',
        sourceCampaign: 'Anuncio laser Instagram',
        sourceAd: 'Depilacao a laser Maeve',
        sourceUrl: 'https://example.com/ad',
    })

    assert.equal(result.session.leadDraft.sourceCampaign, 'Anuncio laser Instagram')
    assert.equal(result.session.leadDraft.sourceAd, 'Depilacao a laser Maeve')
    assert.equal(result.session.leadDraft.sourceUrl, 'https://example.com/ad')
    assert.equal(ai.calls[0].session.leadDraft.sourceCampaign, 'Anuncio laser Instagram')
})

test('handoff leva resumo e slots ricos para equipe humana', async () => {
    let dispatchedPayload = null
    const handoffGateway = {
        async dispatch(payload) {
            dispatchedPayload = payload
            return { handoffId: 'handoff-test', dispatchedAt: new Date().toISOString(), channel: 'human_team' }
        },
    }
    const ai = createFakeAi([
        turn({
            intent: 'schedule_interest',
            reply: 'Perfeito, vou deixar uma avaliacao encaminhada pra equipe te orientar por aqui.',
            nextState: CONVERSATION_STATE.READY_FOR_HANDOFF,
            slots: {
                service: 'drenagem',
                objective: 'emagrecimento',
                bodyArea: 'abdomen',
                budgetConcern: true,
                budgetPreference: 'opcoes acessiveis primeiro',
                preferredWindow: 'manha',
                expectationRisk: 'drenagem_nao_emagrece_sozinha',
                territoryHint: 'Jardim Imperial',
                sourceCampaign: 'Anuncio drenagem',
                handoffSummary: 'Interessada em drenagem para emagrecimento; alinhar expectativa e explicar avaliacao.',
                nextSuggestedAction: 'explicar avaliacao e opcoes sem compromisso',
                qualificationReasons: ['objetivo', 'servico', 'orcamento'],
            },
            handoff: { recommended: true, reason: 'avaliacao_solicitada', priority: 'normal' },
        }),
    ])
    const service = createService(ai, { handoffGateway })

    const result = await service.handleMessage({ from: '5565999008000', message: 'quero avaliar drenagem pra emagrecer' })

    assert.ok(result.leadId)
    assert.ok(result.handoffId)
    assert.equal(dispatchedPayload.qualificationContext.service, 'drenagem')
    assert.equal(dispatchedPayload.qualificationContext.objective, 'emagrecimento')
    assert.equal(dispatchedPayload.qualificationContext.bodyArea, 'abdomen')
    assert.equal(dispatchedPayload.qualificationContext.budgetConcern, true)
    assert.equal(dispatchedPayload.qualificationContext.sourceCampaign, 'Anuncio drenagem')
    assert.match(dispatchedPayload.handoffSummary, /Interessada em drenagem/i)
    assert.equal(dispatchedPayload.nextSuggestedAction, 'explicar avaliacao e opcoes sem compromisso')
})

test('handoff leva contexto de tecnologia em linguagem operacional', async () => {
    let dispatchedPayload = null
    const handoffGateway = {
        async dispatch(payload) {
            dispatchedPayload = payload
            return { handoffId: 'handoff-tech', dispatchedAt: new Date().toISOString(), channel: 'human_team' }
        },
    }
    const ai = createFakeAi([
        turn({
            intent: 'schedule_interest',
            reply: 'Sim, a Maeve trabalha com protocolos corporais para esse objetivo. Vou deixar a equipe te orientar pela avaliacao.',
            nextState: CONVERSATION_STATE.READY_FOR_HANDOFF,
            slots: {
                service: 'protocolo_personalizado_maeve',
                objective: 'gordura localizada',
                bodyArea: 'abdomen',
                technologyContext: 'protocolo corporal usando criolipolise, radiofrequencia e ultrassom',
                technologyMentioned: 'nao citado para cliente',
                protocolRationale: 'confirmar avaliacao antes de escolher a tecnologia',
            },
            handoff: { recommended: true, reason: 'avaliacao_solicitada', priority: 'normal' },
        }),
    ])
    const service = createService(ai, { handoffGateway })

    const result = await service.handleMessage({ from: '5565999009000', message: 'quero avaliar gordura no abdomen' })

    assert.ok(result.leadId)
    assert.equal(result.session.leadDraft.technologyContext, 'protocolo corporal usando criolipolise, radiofrequencia e ultrassom')
    assert.equal(dispatchedPayload.qualificationContext.technologyMentioned, 'nao citado para cliente')
    assert.equal(dispatchedPayload.qualificationContext.protocolRationale, 'confirmar avaliacao antes de escolher a tecnologia')
    assert.match(dispatchedPayload.handoffSummary, /tecnologia: protocolo corporal/i)
    assert.doesNotMatch(result.messages.join('\n'), /Criodermis|Ultra-K|Effect|Hakon/i)
})

test('falha da IA usa fallback seguro sem travar a conversa', async () => {
    const service = createService(createFakeAi([new Error('gemini unavailable')]))

    const result = await service.handleMessage({ from: '5565999666000', message: 'oi' })

    assert.equal(result.state, CONVERSATION_STATE.DISCOVERY)
    assert.equal(result.nlu.source, 'fallback')
    assert.match(result.messages.join('\n'), /seja bem-vinda/i)
    assert.match(result.messages.join('\n'), /me conta/i)
    assert.doesNotMatch(result.messages.join('\n'), /atendimento com todo o cuidado que voce merece/i)
})
