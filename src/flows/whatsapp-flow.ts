import { addKeyword, createFlow, utils } from '@builderbot/bot'

import { LEAD_TEMPERATURE } from '../domain/entities/lead.ts'
import { HIGH_RISK_KEYWORDS } from '../domain/services/safety-guard.service.ts'

const FLOW_ERROR_MESSAGE = [
    'Tive uma instabilidade ao processar sua solicitacao.',
    'Ja encaminhei para atendimento humano para continuar com seguranca.',
].join('\n')

const CLOSING_MESSAGE = 'Perfeito. Nossa equipe humana continua daqui. Quando quiser reiniciar, digite *agendar*.'

const leadTemperatureMessage = (temperature) => {
    if (temperature === LEAD_TEMPERATURE.HOT) return 'Seu interesse esta pronto para atendimento prioritario.'
    if (temperature === LEAD_TEMPERATURE.WARM) return 'Voce esta quase pronto para agendar, nossa equipe vai ajudar com os detalhes.'
    return 'Vamos te orientar sem pressa para encontrar a melhor opcao.'
}

const isYes = (policyService, value = '') => policyService.parseYesNo(value) === true
const isNo = (policyService, value = '') => policyService.parseYesNo(value) === false
const logFlowError = (context, error) => console.error(`[flow:${context}]`, error)

const dispatchEmergencyHandoff = async (dependencies, ctx, objective) => {
    const intake = await dependencies.intakeLeadUseCase.execute({
        phoneNumber: ctx.from,
        name: 'Paciente',
        objective,
        preferredWindow: 'urgente',
        consent: false,
        source: 'chat',
    })

    await dependencies.handoffLeadUseCase.execute({
        leadId: intake.lead.id,
        reason: 'sinal_de_risco',
        requestedBy: 'flow',
    })
}

const dispatchRiskHandoff = async (dependencies, ctx, fallbackName, objective, reason) => {
    const intake = await dependencies.intakeLeadUseCase.execute({
        phoneNumber: ctx.from,
        name: fallbackName,
        objective,
        preferredWindow: 'nao informado',
        consent: false,
        source: 'chat',
    })

    await dependencies.handoffLeadUseCase.execute({
        leadId: intake.lead.id,
        reason,
        requestedBy: 'flow',
    })
}

const createClosingFlow = () => addKeyword(utils.setEvent('CLOSING_FLOW')).addAnswer(CLOSING_MESSAGE)

const createObjectionsFlow = () =>
    addKeyword(['preco', 'valor', 'custa', 'caro', 'doi', 'dor', 'recuperacao', 'seguro']).addAnswer(
        [
            'Entendo sua duvida.',
            'No momento nao fecho diagnostico por aqui, mas posso te encaminhar para avaliacao com a equipe.',
            'Se quiser continuar, digite *agendar*.',
        ].join('\n')
    )

const createEmergencyFlow = (dependencies, closingFlow) =>
    addKeyword(HIGH_RISK_KEYWORDS).addAction(async (ctx, { flowDynamic, gotoFlow }) => {
        const objective = String(ctx.body ?? 'Relato de risco no chat').trim()

        try {
            await dispatchEmergencyHandoff(dependencies, ctx, objective)
            await flowDynamic(
                [
                    'Recebi seu relato e, por seguranca, nao posso orientar conduta clinica por aqui.',
                    'Encaminhei agora para atendimento humano prioritario.',
                ].join('\n')
            )
        } catch (error) {
            logFlowError('emergency_handoff', error)
            await flowDynamic(FLOW_ERROR_MESSAGE)
        }

        return gotoFlow(closingFlow)
    })

const createWelcomeFlow = (dependencies, closingFlow) =>
    addKeyword(['oi', 'ola', 'agendar', 'agenda', 'quero agendar', 'avaliacao'])
        .addAnswer(
            [
                'Oi, eu sou a assistente virtual da clinica.',
                'Posso te ajudar a agilizar seu agendamento no WhatsApp em poucas perguntas.',
                'Tudo bem continuar? Responda *sim* ou *nao*.',
            ].join('\n'),
            { capture: true },
            async (ctx, { state, fallBack, gotoFlow }) => {
                if (isNo(dependencies.conversationPolicyService, ctx.body)) return gotoFlow(closingFlow)
                if (!isYes(dependencies.conversationPolicyService, ctx.body)) {
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
            const risk = dependencies.safetyGuardService.evaluateText(objective)

            await state.update({ leadObjective: objective })
            if (!risk.highRisk && !risk.diagnosisRequest) return

            const fallbackName = String(state.get('leadName') ?? 'Paciente')

            try {
                await dispatchRiskHandoff(dependencies, ctx, fallbackName, objective, risk.recommendedAction)
                await flowDynamic(
                    [
                        `${fallbackName}, por seguranca eu nao posso fornecer diagnostico ou conduta clinica por chat.`,
                        'Encaminhei sua conversa para nossa equipe humana.',
                    ].join('\n')
                )
            } catch (error) {
                logFlowError('risk_handoff', error)
                await flowDynamic(FLOW_ERROR_MESSAGE)
            }

            return gotoFlow(closingFlow)
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
                if (isNo(dependencies.conversationPolicyService, ctx.body)) {
                    await flowDynamic(
                        [
                            'Sem o consentimento nao posso armazenar os dados.',
                            'Se mudar de ideia, digite *agendar* para recomecar.',
                        ].join('\n')
                    )
                    return gotoFlow(closingFlow)
                }

                if (!isYes(dependencies.conversationPolicyService, ctx.body)) {
                    return fallBack('Para continuar, responda com *sim* ou *nao*.')
                }

                try {
                    const intake = await dependencies.intakeLeadUseCase.execute({
                        phoneNumber: ctx.from,
                        name: String(state.get('leadName') ?? 'Paciente').trim() || 'Paciente',
                        objective: String(state.get('leadObjective') ?? 'avaliacao geral').trim() || 'avaliacao geral',
                        preferredWindow: String(state.get('preferredWindow') ?? 'nao informado').trim(),
                        consent: true,
                        source: 'chat',
                    })

                    await dependencies.handoffLeadUseCase.execute({
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
                } catch (error) {
                    logFlowError('qualified_handoff', error)
                    await flowDynamic(FLOW_ERROR_MESSAGE)
                }

                return gotoFlow(closingFlow)
            }
        )

export const buildWhatsAppFlow = (dependencies) => {
    const closingFlow = createClosingFlow()
    const objectionsFlow = createObjectionsFlow()
    const emergencyFlow = createEmergencyFlow(dependencies, closingFlow)
    const welcomeFlow = createWelcomeFlow(dependencies, closingFlow)

    return createFlow([emergencyFlow, objectionsFlow, welcomeFlow, closingFlow])
}
