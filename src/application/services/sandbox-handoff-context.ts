export const usefulDetailFields = [
    'bodyArea',
    'skinToneOrPhototype',
    'budgetConcern',
    'budgetPreference',
    'preferredWindow',
    'objection',
    'urgency',
    'expectationRisk',
    'territoryHint',
    'userNeighborhood',
]

export const textSlotFields = [
    'preferredWindow',
    'objection',
    'urgency',
    'bodyArea',
    'skinToneOrPhototype',
    'budgetPreference',
    'expectationRisk',
    'territoryHint',
    'userNeighborhood',
    'sourceCampaign',
    'sourceAd',
    'sourceUrl',
    'technologyContext',
    'technologyMentioned',
    'protocolRationale',
    'handoffSummary',
    'nextSuggestedAction',
]

const extendedLeadFields = [
    'service',
    'objective',
    ...usefulDetailFields,
    'sourceCampaign',
    'sourceAd',
    'sourceUrl',
    'technologyContext',
    'technologyMentioned',
    'protocolRationale',
    'handoffSummary',
    'qualificationReasons',
    'nextSuggestedAction',
]

export const buildHandoffSummary = (draft = {}) => {
    const parts = []
    if (draft.service) parts.push(`interesse em ${draft.service}`)
    if (draft.objective) parts.push(`objetivo: ${draft.objective}`)
    if (draft.bodyArea) parts.push(`regiao: ${draft.bodyArea}`)
    if (draft.skinToneOrPhototype) parts.push(`tom de pele/fototipo: ${draft.skinToneOrPhototype}`)
    if (draft.budgetConcern || ['price', 'preco'].includes(draft.objection)) parts.push('objecao de preco')
    if (draft.budgetPreference) parts.push(`preferencia de investimento: ${draft.budgetPreference}`)
    if (draft.preferredWindow) parts.push(`janela: ${draft.preferredWindow}`)
    if (draft.expectationRisk) parts.push(`expectativa alinhada: ${draft.expectationRisk}`)
    if (draft.territoryHint || draft.userNeighborhood) parts.push(`contexto local: ${draft.territoryHint ?? draft.userNeighborhood}`)
    if (draft.sourceCampaign || draft.sourceAd) parts.push(`origem: ${draft.sourceCampaign ?? draft.sourceAd}`)
    if (draft.technologyContext) parts.push(`tecnologia: ${draft.technologyContext}`)
    if (draft.protocolRationale) parts.push(`racional do protocolo: ${draft.protocolRationale}`)

    return parts.length ? parts.join('; ') : 'Lead pediu continuidade pelo WhatsApp.'
}

export const resolveNextSuggestedAction = (draft = {}, decision = {}) => {
    if (draft.territoryHint || draft.userNeighborhood) return 'mandar pin e seguir com avaliacao'
    if (decision.intent === 'price_question' || draft.budgetConcern) return 'explicar avaliacao e opcoes sem compromisso'
    if (draft.service && draft.objective) return 'chamar para orientar avaliacao'
    return 'chamar pelo WhatsApp'
}

export const buildQualificationContext = (draft = {}, decision = {}) => {
    const context = {}
    for (const field of extendedLeadFields) {
        if (Array.isArray(draft[field]) && draft[field].length) context[field] = draft[field]
        else if (draft[field] !== undefined && draft[field] !== null && draft[field] !== '') context[field] = draft[field]
    }

    return {
        ...context,
        handoffSummary: draft.handoffSummary ?? buildHandoffSummary(draft),
        nextSuggestedAction: draft.nextSuggestedAction ?? resolveNextSuggestedAction(draft, decision),
        nlu: {
            intent: decision.intent,
            source: decision.source,
            modelUsed: decision.modelUsed,
            confidence: decision.confidence,
        },
    }
}
