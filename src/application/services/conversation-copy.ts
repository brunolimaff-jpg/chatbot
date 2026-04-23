import { LEAD_TEMPERATURE } from '../../domain/entities/lead.ts'

export const conversationCopy = Object.freeze({
    askContinue:
        'Oi, eu sou a assistente virtual da clinica. Posso te ajudar com seu agendamento em poucas perguntas. Tudo bem continuar? Responda *sim* ou *nao*.',
    askName: 'Qual e o seu nome?',
    askObjective: 'Qual procedimento ou resultado estetico voce procura hoje?',
    askUrgency: 'Para quando voce gostaria de ser atendido(a)?',
    askObjection: 'O que mais pesa pra voce hoje: preco, dor, recuperacao, seguranca ou outro?',
    askWindow: 'Qual periodo voce prefere para atendimento? (manha, tarde, noite ou horario especifico)',
    askConsent:
        'Voce autoriza o uso dos seus dados para contato e agendamento? Responda *sim* ou *nao*.',
    askSummaryConfirm:
        'Perfeito. Posso encaminhar agora seu resumo para a recepcao finalizar o agendamento? Responda *sim* ou *nao*.',
    close: 'Perfeito. Nossa equipe humana continua daqui. Quando quiser reiniciar, digite *agendar*.',
    consentRequired: 'Sem consentimento eu nao posso armazenar seus dados. Quando quiser, digite *agendar*.',
    risk:
        'Por seguranca, nao posso orientar diagnostico ou conduta clinica no chat. Encaminhei agora para atendimento humano.',
    invalid: 'Nao entendi. ',
})

export const leadTemperatureMessage = (temperature) => {
    if (temperature === LEAD_TEMPERATURE.HOT) return 'Seu interesse esta pronto para atendimento prioritario.'
    if (temperature === LEAD_TEMPERATURE.WARM) return 'Voce esta quase pronto para agendar, nossa equipe ajuda com os detalhes.'
    return 'Vamos te orientar sem pressa para encontrar a melhor opcao.'
}

export const buildSummaryMessage = (draft) =>
    [
        'Resumo rapido:',
        `Nome: ${draft.name ?? 'nao informado'}`,
        `Objetivo: ${draft.objective ?? 'nao informado'}`,
        `Urgencia: ${draft.urgency ?? 'nao informado'}`,
        `Principal objecao: ${draft.objection ?? 'nao informado'}`,
        `Janela preferida: ${draft.preferredWindow ?? 'nao informado'}`,
    ].join('\n')
