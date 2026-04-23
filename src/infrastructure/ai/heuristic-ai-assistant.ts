import { LEAD_INTEREST } from '../../domain/entities/lead.ts'

const normalize = (text = '') =>
    String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

const includesAny = (text, terms) => terms.some((term) => text.includes(term))

export class HeuristicAiAssistant {
    async assessText(text = '') {
        const normalized = normalize(text)

        const interest = this.resolveInterest(normalized)
        const urgency = this.resolveUrgency(normalized)
        const objectionTag = this.resolveObjection(normalized)

        const summaryParts = [
            `Interesse inferido: ${interest}.`,
            `Urgencia: ${urgency}.`,
            objectionTag === 'nenhuma' ? 'Sem objecoes explicitas.' : `Objecao principal: ${objectionTag}.`,
        ]

        return {
            interest,
            urgency,
            objectionTag,
            summary: summaryParts.join(' '),
        }
    }

    resolveInterest(text) {
        if (includesAny(text, ['botox', 'toxina', 'rugas'])) return LEAD_INTEREST.BOTULINUM
        if (includesAny(text, ['preenchimento', 'labio', 'bigode chines'])) return LEAD_INTEREST.FILLER
        if (includesAny(text, ['laser', 'depilacao'])) return LEAD_INTEREST.LASER
        if (includesAny(text, ['limpeza de pele', 'pele', 'acne', 'mancha'])) return LEAD_INTEREST.SKIN_CARE
        if (includesAny(text, ['flacidez', 'colageno', 'bioestimulador'])) return LEAD_INTEREST.BIOSTIMULATOR
        if (includesAny(text, ['avaliacao', 'avaliacao geral', 'quero saber'])) return LEAD_INTEREST.GENERAL_EVALUATION
        return LEAD_INTEREST.OTHER
    }

    resolveUrgency(text) {
        if (includesAny(text, ['hoje', 'amanha', 'amanha', 'urgente', 'evento', 'casamento'])) return 'alta'
        if (includesAny(text, ['essa semana', 'proximos dias', 'próximos dias'])) return 'media'
        return 'baixa'
    }

    resolveObjection(text) {
        if (includesAny(text, ['preco', 'valor', 'custa', 'caro'])) return 'preco'
        if (includesAny(text, ['doi', 'dói', 'dor'])) return 'dor'
        if (includesAny(text, ['seguro', 'risco', 'efeito colateral'])) return 'seguranca'
        if (includesAny(text, ['recuperacao', 'recuperação', 'afastado', 'tempo'])) return 'tempo_recuperacao'
        return 'nenhuma'
    }
}
