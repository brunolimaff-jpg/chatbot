import { createBot, createProvider, createFlow, addKeyword, utils } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'

import { IntakeLeadUseCase } from './application/use-cases/intake-lead.use-case.ts'
import { HandoffLeadUseCase } from './application/use-cases/handoff-lead.use-case.ts'
import { LeadQualificationService } from './domain/services/lead-qualification.service.ts'
import { SafetyGuardService } from './domain/services/safety-guard.service.ts'
import { HeuristicAiAssistant } from './infrastructure/ai/heuristic-ai-assistant.ts'
import { ConsoleHandoffGateway } from './infrastructure/handoff/console-handoff.gateway.ts'
import { InMemoryLeadRepository } from './infrastructure/repositories/in-memory-lead.repository.ts'
import { retry } from './shared/retry.ts'

const PORT = process.env.PORT ?? 3008

const leadRepository = new InMemoryLeadRepository()
const aiAssistant = new HeuristicAiAssistant()
const safetyGuardService = new SafetyGuardService()
const leadQualificationService = new LeadQualificationService()
const handoffGateway = new ConsoleHandoffGateway()

const intakeLeadUseCase = new IntakeLeadUseCase({
    leadRepository,
    aiAssistant,
    safetyGuardService,
    leadQualificationService,
})

const handoffLeadUseCase = new HandoffLeadUseCase({
    leadRepository,
    handoffGateway,
})

const normalize = (value = '') =>
    String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()

const isYes = (value = '') => {
    const normalized = normalize(value)
    return ['sim', 'claro', 'ok', 'autorizo', 'aceito', 'pode'].some((item) => normalized.includes(item))
}

const isNo = (value = '') => {
    const normalized = normalize(value)
    return ['nao', 'negativo', 'recuso', 'prefiro nao', 'prefiro não'].some((item) => normalized.includes(item))
}

const sendJson = (res, statusCode, payload) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(payload))
}

const leadTemperatureMessage = (temperature) => {
    if (temperature === 'quente') return 'Seu interesse esta pronto para atendimento prioritario.'
    if (temperature === 'morno') return 'Voce esta quase pronto para agendar, nossa equipe vai ajudar com os detalhes.'
    return 'Vamos te orientar sem pressa para encontrar a melhor opcao.'
}

const closingFlow = addKeyword(utils.setEvent('CLOSING_FLOW')).addAnswer(
    'Perfeito. Nossa equipe humana continua daqui. Quando quiser reiniciar, digite *agendar*.'
)

const objectionsFlow = addKeyword(['preco', 'valor', 'custa', 'caro', 'doi', 'dor', 'recuperacao', 'seguro']).addAnswer(
    [
        'Entendo sua duvida.',
        'No momento nao fecho diagnostico por aqui, mas posso te encaminhar para avaliacao com a equipe.',
        'Se quiser continuar, digite *agendar*.',
    ].join('\n')
)

const emergencyFlow = addKeyword([
    'dor intensa',
    'sangramento',
    'falta de ar',
    'infeccao',
    'infecao',
    'febre',
    'necrose',
]).addAction(async (ctx, { flowDynamic, gotoFlow }) => {
    const fallbackName = 'Paciente'
    const objective = String(ctx.body ?? 'Relato de risco no chat').trim()

    const intake = await intakeLeadUseCase.execute({
        phoneNumber: ctx.from,
        name: fallbackName,
        objective,
        preferredWindow: 'urgente',
        consent: false,
        source: 'chat',
    })

    await handoffLeadUseCase.execute({
        leadId: intake.lead.id,
        reason: 'sinal_de_risco',
        requestedBy: 'flow',
    })

    await flowDynamic(
        [
            'Recebi seu relato e, por seguranca, nao posso orientar conduta clinica por aqui.',
            'Encaminhei agora para atendimento humano prioritario.',
        ].join('\n')
    )

    return gotoFlow(closingFlow)
})

const welcomeFlow = addKeyword(['oi', 'ola', 'olá', 'agendar', 'agenda', 'quero agendar', 'avaliacao']).addAnswer(
    [
        'Oi, eu sou a assistente virtual da clinica.',
        'Posso te ajudar a agilizar seu agendamento no WhatsApp em poucas perguntas.',
        'Tudo bem continuar? Responda *sim* ou *nao*.',
    ].join('\n'),
    { capture: true },
    async (ctx, { state, fallBack, gotoFlow }) => {
        if (isNo(ctx.body)) {
            return gotoFlow(closingFlow)
        }

        if (!isYes(ctx.body)) {
            return fallBack('Responda com *sim* para continuar ou *nao* para encerrar.')
        }

        await state.update({ entryConsent: true })
        return
    }
)
    .addAnswer('Qual e o seu nome?', { capture: true }, async (ctx, { state }) => {
        await state.update({ leadName: String(ctx.body ?? '').trim() })
    })
    .addAnswer('Qual procedimento ou resultado estetico voce procura hoje?', { capture: true }, async (ctx, tools) => {
        const { state, flowDynamic, gotoFlow } = tools
        const objective = String(ctx.body ?? '').trim()
        const risk = safetyGuardService.evaluateText(objective)

        await state.update({ leadObjective: objective })

        if (risk.highRisk || risk.diagnosisRequest) {
            const fallbackName = String(state.get('leadName') ?? 'Paciente')
            const intake = await intakeLeadUseCase.execute({
                phoneNumber: ctx.from,
                name: fallbackName,
                objective,
                preferredWindow: 'nao informado',
                consent: false,
                source: 'chat',
            })

            await handoffLeadUseCase.execute({
                leadId: intake.lead.id,
                reason: risk.recommendedAction,
                requestedBy: 'flow',
            })

            await flowDynamic(
                [
                    `${fallbackName}, por seguranca eu nao posso fornecer diagnostico ou conduta clinica por chat.`,
                    'Encaminhei sua conversa para nossa equipe humana.',
                ].join('\n')
            )

            return gotoFlow(closingFlow)
        }

        return
    })
    .addAnswer(
        'Qual periodo voce prefere para atendimento? (manha, tarde, noite ou dia/horario especifico)',
        { capture: true },
        async (ctx, { state }) => {
            await state.update({ preferredWindow: String(ctx.body ?? '').trim() })
        }
    )
    .addAnswer(
        'Voce autoriza o uso desses dados para contato e agendamento? Responda *sim* ou *nao*.',
        { capture: true },
        async (ctx, tools) => {
            const { state, flowDynamic, gotoFlow, fallBack } = tools

            if (isNo(ctx.body)) {
                await flowDynamic(
                    [
                        'Sem o consentimento nao posso armazenar os dados.',
                        'Se mudar de ideia, digite *agendar* para recomeçar.',
                    ].join('\n')
                )
                return gotoFlow(closingFlow)
            }

            if (!isYes(ctx.body)) {
                return fallBack('Para continuar, responda com *sim* ou *nao*.')
            }

            const leadName = String(state.get('leadName') ?? '').trim()
            const leadObjective = String(state.get('leadObjective') ?? '').trim()
            const preferredWindow = String(state.get('preferredWindow') ?? 'nao informado').trim()

            const intake = await intakeLeadUseCase.execute({
                phoneNumber: ctx.from,
                name: leadName || 'Paciente',
                objective: leadObjective || 'avaliacao geral',
                preferredWindow,
                consent: true,
                source: 'chat',
            })

            await handoffLeadUseCase.execute({
                leadId: intake.lead.id,
                reason: 'lead_qualificado_whatsapp',
                requestedBy: 'flow',
            })

            await flowDynamic(
                [
                    `${intake.lead.name}, recebi seus dados com sucesso.`,
                    leadTemperatureMessage(intake.lead.temperature),
                    'Nossa recepcao vai te chamar neste numero para confirmar seu melhor horario.',
                ].join('\n')
            )

            return gotoFlow(closingFlow)
        }
    )

const main = async () => {
    const adapterFlow = createFlow([emergencyFlow, objectionsFlow, welcomeFlow, closingFlow])

    const adapterProvider = createProvider(Provider, {
        version: [2, 3000, 1035824857],
    })
    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const payload = req.body ?? {}
            const number = String(payload.number ?? '')
            const message = String(payload.message ?? '')
            const urlMedia = payload.urlMedia ?? null

            if (!number || !message) {
                return sendJson(res, 400, {
                    status: 'error',
                    message: 'number and message are required',
                })
            }

            try {
                await retry(
                    async () => {
                        await bot.sendMessage(number, message, { media: urlMedia })
                    },
                    { attempts: 3, delayMs: 500 }
                )

                return sendJson(res, 200, {
                    status: 'ok',
                    message: 'sent',
                })
            } catch {
                return sendJson(res, 503, {
                    status: 'error',
                    message: 'failed to deliver after retries',
                    fallback: 'manual_handoff_required',
                })
            }
        })
    )

    adapterProvider.server.post(
        '/v1/lead/intake',
        handleCtx(async (_bot, req, res) => {
            const payload = req.body ?? {}
            const number = String(payload.number ?? '')
            const name = String(payload.name ?? '')
            const objective = String(payload.objective ?? '')
            const preferredWindow = String(payload.preferredWindow ?? 'nao informado')
            const consent = payload.consent === true || isYes(String(payload.consent ?? ''))

            if (!number || !name || !objective) {
                return sendJson(res, 400, {
                    status: 'error',
                    message: 'number, name and objective are required',
                })
            }

            try {
                const intake = await intakeLeadUseCase.execute({
                    phoneNumber: number,
                    name,
                    objective,
                    preferredWindow,
                    consent,
                    source: 'api',
                })

                return sendJson(res, 201, {
                    status: 'ok',
                    leadId: intake.lead.id,
                    temperature: intake.lead.temperature,
                    qualificationScore: intake.lead.qualificationScore,
                    nextAction: intake.nextAction,
                    risk: intake.risk,
                })
            } catch (error) {
                return sendJson(res, 422, {
                    status: 'error',
                    message: error.message,
                })
            }
        })
    )

    adapterProvider.server.post(
        '/v1/lead/handoff',
        handleCtx(async (_bot, req, res) => {
            const payload = req.body ?? {}
            const leadId = payload.leadId ? String(payload.leadId) : null
            const phoneNumber = payload.number ? String(payload.number) : null
            const reason = payload.reason ? String(payload.reason) : 'solicitacao_manual_api'

            if (!leadId && !phoneNumber) {
                return sendJson(res, 400, {
                    status: 'error',
                    message: 'leadId or number is required',
                })
            }

            try {
                const handoff = await handoffLeadUseCase.execute({
                    leadId,
                    phoneNumber,
                    reason,
                    requestedBy: 'api',
                })

                return sendJson(res, 200, {
                    status: 'ok',
                    leadId: handoff.lead.id,
                    handoffId: handoff.handoff.handoffId,
                    dispatchedAt: handoff.handoff.dispatchedAt,
                })
            } catch (error) {
                return sendJson(res, 404, {
                    status: 'error',
                    message: error.message,
                })
            }
        })
    )

    adapterProvider.server.get(
        '/health',
        handleCtx(async (_bot, _req, res) => {
            return sendJson(res, 200, {
                status: 'ok',
                service: 'chatbot-clinica-estetica',
                uptimeSeconds: Math.floor(process.uptime()),
            })
        })
    )

    httpServer(Number(PORT))
}

main()
