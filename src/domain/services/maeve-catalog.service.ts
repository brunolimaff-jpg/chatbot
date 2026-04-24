export class MaeveCatalogService {
    constructor() {
        this.services = [
            {
                id: 'protocolo_personalizado_maeve',
                label: 'Protocolo Personalizado Maeve',
                aliases: ['estetica avancada', 'protocolo', 'flacidez', 'celulite', 'gordura localizada'],
            },
            {
                id: 'depilacao_laser',
                label: 'Depilacao a Laser',
                aliases: ['laser', 'depilacao', 'pelos', 'foliculite'],
            },
            {
                id: 'drenagem_linfatica',
                label: 'Drenagem Linfatica',
                aliases: ['drenagem', 'inchaco', 'retencao', 'linfatica'],
            },
            {
                id: 'massagem_modeladora',
                label: 'Massagem Modeladora',
                aliases: ['modeladora', 'contorno', 'medidas'],
            },
            {
                id: 'massagem_relaxante',
                label: 'Massagem Relaxante',
                aliases: ['relaxante', 'relaxar', 'tensao', 'estresse'],
            },
            {
                id: 'massagem_pos_operatoria',
                label: 'Massagem Pos-Operatoria',
                aliases: ['pos operatorio', 'pos-operatorio', 'cirurgia', 'lipo'],
            },
            {
                id: 'limpeza_pele',
                label: 'Limpeza de Pele',
                aliases: ['limpeza de pele', 'cravos', 'oleosidade', 'acne'],
            },
            {
                id: 'dermaplaning',
                label: 'Dermaplaning',
                aliases: ['dermaplaning', 'pelinhos', 'textura'],
            },
        ]
        this.technologies = [
            {
                id: 'dermosteam',
                publicName: 'Dermosteam',
                internalModel: 'Dermosteam Ibramed',
                brand: 'Ibramed',
                plainUse: 'preparo da pele com vapor ozonizado em limpeza de pele e cuidados de hidratacao',
                clientFriendlyBenefits: ['ajuda a preparar a pele', 'favorece emoliencia', 'apoia higienizacao com mais conforto'],
                relatedServices: ['limpeza_pele'],
                aliases: ['dermosteam', 'vapor', 'vapor de ozonio', 'limpeza de pele', 'acne', 'comedoes'],
                whenToMention: 'cite apenas se perguntarem sobre aparelho ou se a pessoa pedir detalhes da limpeza de pele',
                avoidClaims: ['resultado garantido', 'cura acne', 'substitui avaliacao profissional'],
                safetyNotes: ['avaliar sensibilidade da pele antes do protocolo', 'nao diagnosticar lesoes pelo chat'],
            },
            {
                id: 'hf_ibramed',
                publicName: 'Alta Frequencia',
                internalModel: 'HF Ibramed',
                brand: 'Ibramed',
                plainUse: 'apoio em protocolos de pele, couro cabeludo, pos-extracao e pos-depilacao',
                clientFriendlyBenefits: ['apoia o cuidado da pele', 'pode complementar protocolos de limpeza', 'ajuda no acabamento do atendimento'],
                relatedServices: ['limpeza_pele', 'depilacao_laser', 'protocolo_personalizado_maeve'],
                aliases: ['hf', 'alta frequencia', 'ibramed', 'acne', 'pos extracao', 'pos-depilacao', 'couro cabeludo'],
                whenToMention: 'cite como complemento de protocolo quando a cliente perguntar sobre recursos usados no cuidado de pele',
                avoidClaims: ['cicatrizacao garantida', 'tratamento medico', 'resolve acne sozinho'],
                safetyNotes: ['usar apenas como recurso profissional indicado em avaliacao', 'evitar promessa sobre acne ou lesoes'],
            },
            {
                id: 'hakon_laser',
                publicName: 'Hakon',
                internalModel: 'Hakon 4D Medical San',
                brand: 'Medical San',
                plainUse: 'laser de depilacao para protocolos de reducao de pelos em diferentes fototipos',
                clientFriendlyBenefits: ['apoia um atendimento mais personalizado', 'permite avaliar pele e pelo antes do protocolo', 'reforca seguranca na escolha do laser'],
                relatedServices: ['depilacao_laser'],
                aliases: ['hakon', 'laser', 'depilacao', 'epilacao', 'pelos', 'fototipo', 'pele negra'],
                whenToMention: 'cite quando perguntarem qual laser e usado ou quando houver duvida sobre pele, pelo ou fototipo',
                avoidClaims: ['indolor garantido', 'remove todos os pelos', 'resultado definitivo garantido'],
                safetyNotes: ['perguntar tom de pele/fototipo quando relevante', 'orientar avaliacao antes da indicacao'],
            },
            {
                id: 'ultra_k',
                publicName: 'Ultra-K',
                internalModel: 'Ultra-K HTM 40kHz',
                brand: 'HTM',
                plainUse: 'ultrassom de baixa frequencia usado como apoio em protocolos corporais',
                clientFriendlyBenefits: ['apoia protocolos para contorno corporal', 'pode compor cuidado para gordura localizada', 'ajuda a personalizar o protocolo corporal'],
                relatedServices: ['protocolo_personalizado_maeve', 'massagem_modeladora'],
                aliases: ['ultra-k', 'ultra k', 'ultrassom', '40khz', 'gordura localizada', 'celulite', 'contorno', 'abdomen'],
                whenToMention: 'cite apenas em pergunta direta sobre aparelhos ou quando explicar que o protocolo corporal pode combinar tecnologias',
                avoidClaims: ['emagrecimento garantido', 'perda de peso', 'resultado imediato garantido'],
                safetyNotes: ['alinhar que protocolo corporal nao substitui avaliacao', 'nao prometer emagrecimento'],
            },
            {
                id: 'criodermis_smart',
                publicName: 'Criodermis Smart',
                internalModel: 'Criodermis Smart Medical San',
                brand: 'Medical San',
                plainUse: 'criolipolise de placas para avaliacao de gordura localizada em protocolos corporais',
                clientFriendlyBenefits: ['apoia protocolos para gordura localizada', 'permite tratar regioes corporais conforme avaliacao', 'ajuda a montar um plano corporal mais direcionado'],
                relatedServices: ['protocolo_personalizado_maeve', 'massagem_modeladora'],
                aliases: ['criodermis', 'criodermis smart', 'criolipolise', 'gordura localizada', 'medidas', 'abdomen', 'flancos'],
                whenToMention: 'cite se a pessoa perguntar por criolipolise ou por tecnologias para gordura localizada',
                avoidClaims: ['emagrecimento garantido', 'elimina gordura definitivamente', 'dispensa avaliacao'],
                safetyNotes: ['confirmar area e avaliacao antes da indicacao', 'nao prometer reducao de medidas pelo chat'],
            },
            {
                id: 'effect_radiofrequencia',
                publicName: 'Radiofrequencia Effect',
                internalModel: 'Effect HTM',
                brand: 'HTM',
                plainUse: 'radiofrequencia como apoio em protocolos de flacidez, celulite, fibroses e rejuvenescimento',
                clientFriendlyBenefits: ['apoia firmeza da pele', 'pode compor protocolos faciais e corporais', 'ajuda a personalizar o cuidado para flacidez'],
                relatedServices: ['protocolo_personalizado_maeve', 'massagem_modeladora', 'massagem_pos_operatoria'],
                aliases: ['effect', 'radiofrequencia', 'radio frequência', 'flacidez', 'celulite', 'fibrose', 'rejuvenescimento'],
                whenToMention: 'cite em duvidas sobre flacidez, celulite ou quando perguntarem por tecnologia usada',
                avoidClaims: ['lifting garantido', 'rejuvenesce sem limites', 'resolve fibrose sem avaliacao'],
                safetyNotes: ['evitar orientar fibrose pos-cirurgica sem avaliacao humana', 'nao prometer resultado de firmeza'],
            },
            {
                id: 'beauty_dermo',
                publicName: 'Beauty Dermo',
                internalModel: 'Beauty Dermo HTM',
                brand: 'HTM',
                plainUse: 'vacuoterapia e recursos de apoio em protocolos corporais, faciais e pos-operatorios selecionados',
                clientFriendlyBenefits: ['pode apoiar drenagem e protocolos corporais', 'ajuda em cuidados personalizados de textura e contorno', 'complementa atendimentos conforme avaliacao'],
                relatedServices: ['protocolo_personalizado_maeve', 'drenagem_linfatica', 'massagem_pos_operatoria', 'massagem_modeladora', 'limpeza_pele'],
                aliases: ['beauty dermo', 'vacuoterapia', 'ventosaterapia', 'peeling de diamante', 'pump', 'drenagem', 'pos operatorio', 'pos-operatorio'],
                whenToMention: 'use como apoio contextual; cite o nome so quando perguntarem por aparelho ou tecnica',
                avoidClaims: ['recuperacao garantida', 'trata pos-operatorio sem liberacao', 'substitui avaliacao medica'],
                safetyNotes: ['em pos-operatorio, reforcar avaliacao e liberacao adequada', 'nao orientar conduta clinica pelo chat'],
            },
        ]
    }

    listServices() {
        return this.services.map((service) => ({
            ...service,
            technologies: this.technologies
                .filter((technology) => technology.relatedServices.includes(service.id))
                .map((technology) => ({
                    id: technology.id,
                    publicName: technology.publicName,
                    plainUse: technology.plainUse,
                    whenToMention: technology.whenToMention,
                })),
        }))
    }

    listTechnologies() {
        return this.technologies
    }

    buildServicesAnswer() {
        const list = this.services.map((service) => `- ${service.label}`).join('\n')
        return [
            'Na Maeve, a indicacao nasce de uma avaliacao personalizada. Hoje trabalhamos com:',
            list,
            'Me conta qual cuidado faz mais sentido para voce agora: pele, pelos, relaxamento, pos-operatorio ou contorno corporal?',
        ].join('\n')
    }

    buildPriceAnswer() {
        return [
            'Entendo sua pergunta. Na Maeve, o valor depende do objetivo, da avaliacao e do protocolo indicado para voce.',
            'Para nao te passar uma informacao fria ou imprecisa, eu vou deixar sua conversa pronta para a equipe continuar com mais detalhe.',
            'Me conta rapidinho qual resultado voce busca para eu encaminhar do jeito certo?',
        ].join('\n')
    }

    resolveService(text = '') {
        const normalized = this.normalize(text)
        return this.services.find((service) =>
            service.aliases.some((alias) => normalized.includes(this.normalize(alias)))
        ) ?? null
    }

    resolveTechnologyContext(text = '') {
        const normalized = this.normalize(text)
        const matched = this.technologies.filter((technology) =>
            technology.aliases.some((alias) => normalized.includes(this.normalize(alias)))
        )
        const technologies = this.prioritizeTechnologies(normalized, matched)

        return {
            summary: this.buildTechnologySummary(normalized, technologies),
            technologies,
        }
    }

    prioritizeTechnologies(normalized, technologies) {
        if (this.matchesAny(normalized, ['limpeza de pele', 'acne', 'comedoes'])) {
            return this.pickTechnologies(['dermosteam', 'hf_ibramed'], technologies)
        }
        if (this.matchesAny(normalized, ['depilacao', 'laser', 'pelos', 'fototipo', 'pele negra'])) {
            return this.pickTechnologies(['hakon_laser'], technologies)
        }
        if (this.matchesAny(normalized, ['gordura localizada', 'flacidez', 'celulite', 'abdomen', 'medidas'])) {
            return this.pickTechnologies(['ultra_k', 'criodermis_smart', 'effect_radiofrequencia'], technologies)
        }
        if (this.matchesAny(normalized, ['drenagem', 'pos operatorio', 'pos-operatorio'])) {
            return this.pickTechnologies(['beauty_dermo'], technologies)
        }
        return technologies
    }

    pickTechnologies(ids, fallback = []) {
        const picked = ids
            .map((id) => this.technologies.find((technology) => technology.id === id))
            .filter(Boolean)
        return picked.length ? picked : fallback
    }

    buildTechnologySummary(normalized, technologies = []) {
        if (!technologies.length) return 'Sem tecnologia especifica inferida; manter avaliacao personalizada.'
        if (this.matchesAny(normalized, ['gordura localizada', 'flacidez', 'celulite', 'abdomen', 'medidas'])) {
            return 'Contexto de protocolo corporal com tecnologias de apoio para gordura localizada, flacidez ou celulite.'
        }
        if (this.matchesAny(normalized, ['limpeza de pele', 'acne', 'comedoes'])) {
            return 'Contexto de limpeza de pele com tecnologias de preparo e apoio ao cuidado da pele.'
        }
        if (this.matchesAny(normalized, ['depilacao', 'laser', 'pelos', 'fototipo', 'pele negra'])) {
            return 'Contexto de depilacao a laser com atencao a pele, pelo e fototipo.'
        }
        return 'Tecnologias relacionadas ao objetivo mencionado; confirmar avaliacao antes de indicar protocolo.'
    }

    matchesAny(normalized, terms = []) {
        return terms.some((term) => normalized.includes(this.normalize(term)))
    }

    normalize(text = '') {
        return String(text)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
    }
}
