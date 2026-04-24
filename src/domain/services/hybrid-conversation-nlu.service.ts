const normalize = (text = '') =>
    String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()

const includesAny = (text, terms) => terms.some((term) => text.includes(term))
const YES_NO_STATES = ['INTENT_CONFIRM', 'LGPD_CONSENT']

export class HybridConversationNluService {
    constructor({ aiAssistant, catalogService, safetyGuardService }) {
        this.aiAssistant = aiAssistant
        this.catalogService = catalogService
        this.safetyGuardService = safetyGuardService
    }

    async analyze({ message, session }) {
        const text = String(message ?? '').trim()
        const normalized = normalize(text)
        const risk = this.safetyGuardService.evaluateText(text)

        if (risk.highRisk || risk.diagnosisRequest) {
            return this.result({
                intent: 'clinical_risk',
                answer:
                    'Por seguranca, nao consigo orientar diagnostico ou conduta clinica por aqui. Vou encaminhar para atendimento humano te acompanhar com prioridade.',
                handoffRecommended: true,
                riskFlags: risk,
            })
        }

        if (this.isExit(normalized)) {
            return this.result({ intent: 'exit' })
        }

        if (this.isServiceCatalog(normalized)) {
            return this.result({
                intent: 'service_catalog',
                answer: this.catalogService.buildServicesAnswer(),
                nextBestQuestion: 'Qual cuidado faz mais sentido para voce agora?',
            })
        }

        if (this.isPrice(normalized)) {
            return this.result({
                intent: 'price',
                answer: this.catalogService.buildPriceAnswer(),
                handoffRecommended: true,
                nextBestQuestion: 'Qual resultado voce busca?',
            })
        }

        if (session?.state === 'NAME' && this.isNameRefusal(normalized)) {
            return this.result({
                intent: 'name_refusal',
                slots: { name: 'Paciente' },
            })
        }

        const yesNo = YES_NO_STATES.includes(session?.state) ? this.parseYesNo(normalized) : null
        if (yesNo !== null) {
            return this.result({
                intent: yesNo ? 'affirmation' : 'denial',
                slots: { yesNo },
            })
        }

        const aiNlu = await this.tryAiNlu({ message: text, session })
        if (aiNlu && aiNlu.intent && aiNlu.intent !== 'free_text') {
            return this.result(aiNlu)
        }

        const service = this.catalogService.resolveService(text)
        const slots = {}
        if (service) slots.service = service
        if (session?.state === 'NAME') slots.name = text
        if (session?.state === 'OBJECTIVE') slots.objective = text
        if (session?.state === 'PREFERRED_WINDOW') slots.preferredWindow = text

        return this.result({
            intent: service ? 'service_interest' : 'free_text',
            slots,
        })
    }

    result(payload) {
        return {
            intent: payload.intent,
            slots: payload.slots ?? {},
            answer: payload.answer ?? null,
            riskFlags: payload.riskFlags ?? null,
            handoffRecommended: payload.handoffRecommended ?? false,
            nextBestQuestion: payload.nextBestQuestion ?? null,
            source: payload.source ?? 'rule',
            modelUsed: payload.modelUsed ?? null,
        }
    }

    parseYesNo(normalized) {
        if (includesAny(normalized, ['nao', 'negativo', 'recuso', 'prefiro nao', 'nao autorizo'])) return false
        if (includesAny(normalized, ['sim', 'claro', 'ok', 'pode', 'aceito', 'autorizo'])) return true
        return null
    }

    isExit(normalized) {
        return includesAny(normalized, ['encerrar', 'sair', 'parar', 'cancelar'])
    }

    isServiceCatalog(normalized) {
        return includesAny(normalized, ['quais servicos', 'servicos disponiveis', 'o que voces fazem', 'procedimentos'])
    }

    isPrice(normalized) {
        return includesAny(normalized, ['preco', 'valor', 'quanto custa', 'custa quanto', 'investimento'])
    }

    isNameRefusal(normalized) {
        return includesAny(normalized, ['nao quero falar', 'prefiro nao falar', 'sem nome', 'nao informar nome'])
    }

    async tryAiNlu(input) {
        if (typeof this.aiAssistant?.understandMessage !== 'function') return null
        return this.aiAssistant.understandMessage({
            ...input,
            catalog: this.catalogService.listServices(),
        })
    }
}
