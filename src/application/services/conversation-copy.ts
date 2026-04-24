import { LEAD_TEMPERATURE } from '../../domain/entities/lead.ts'

export const conversationCopy = Object.freeze({
    askContinue:
        'Oi, eu sou a assistente virtual da Maêve. Posso te ajudar com seu agendamento em poucas perguntas. Tudo bem continuar? Responda *sim* ou *não*.',
    askName: 'Qual é o seu nome?',
    askObjective: 'Qual procedimento ou resultado estético você procura hoje?',
    askUrgency: 'Para quando você gostaria de ser atendida?',
    askObjection: 'O que mais pesa para você hoje: preço, dor, recuperação, segurança ou outro ponto?',
    askWindow: 'Qual período você prefere para atendimento? Manhã, tarde, noite ou horário específico?',
    askConsent:
        'Você autoriza o uso dos seus dados para contato e agendamento? Responda *sim* ou *não*.',
    askSummaryConfirm:
        'Perfeito. Posso encaminhar agora seu resumo para a recepção finalizar o agendamento? Responda *sim* ou *não*.',
    close: 'Perfeito. Nossa equipe humana continua daqui. Quando quiser reiniciar, digite *agendar*.',
    consentRequired: 'Sem consentimento eu não posso armazenar seus dados. Quando quiser, digite *agendar*.',
    risk:
        'Por segurança, não posso orientar diagnóstico ou conduta clínica no chat. Encaminhei agora para atendimento humano.',
    invalid: 'Não entendi. ',
})

export const leadTemperatureMessage = (temperature) => {
    if (temperature === LEAD_TEMPERATURE.HOT) return 'Seu interesse está pronto para atendimento prioritário.'
    if (temperature === LEAD_TEMPERATURE.WARM) return 'Você está quase pronta para agendar, nossa equipe ajuda com os detalhes.'
    return 'Vamos te orientar sem pressa para encontrar a melhor opção.'
}

export const buildSummaryMessage = (draft) =>
    [
        'Resumo rápido:',
        `Nome: ${draft.name ?? 'não informado'}`,
        `Objetivo: ${draft.objective ?? 'não informado'}`,
        `Urgência: ${draft.urgency ?? 'não informado'}`,
        `Principal objeção: ${draft.objection ?? 'não informado'}`,
        `Janela preferida: ${draft.preferredWindow ?? 'não informado'}`,
    ].join('\n')
