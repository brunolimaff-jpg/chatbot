import 'dotenv/config'

import { EventEmitter } from 'node:events'
import { createBot, createProvider, createFlow, addKeyword, utils, ProviderClass } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
import { BaileysProvider as Provider } from '@builderbot/provider-baileys'

import { SandboxConversationService } from './application/services/sandbox-conversation.service.ts'
import { HandoffLeadUseCase } from './application/use-cases/handoff-lead.use-case.ts'
import { IntakeLeadUseCase } from './application/use-cases/intake-lead.use-case.ts'
import { LeadQualificationService } from './domain/services/lead-qualification.service.ts'
import { MaeveCatalogService } from './domain/services/maeve-catalog.service.ts'
import { SafetyGuardService } from './domain/services/safety-guard.service.ts'
import { AiFirstConversationOrchestratorService } from './domain/services/ai-first-conversation-orchestrator.service.ts'
import { GeminiAiAssistant } from './infrastructure/ai/gemini-ai-assistant.ts'
import { ConsoleHandoffGateway } from './infrastructure/handoff/console-handoff.gateway.ts'
import { InMemoryConversationRepository } from './infrastructure/repositories/in-memory-conversation.repository.ts'
import { InMemoryLeadRepository } from './infrastructure/repositories/in-memory-lead.repository.ts'
import { retry } from './shared/retry.ts'

const CHANNEL_MODE = Object.freeze({
    WHATSAPP: 'whatsapp',
    SANDBOX: 'sandbox',
})

const env = {
    port: Number(process.env.PORT ?? 3008),
    channelMode: String(process.env.CHATBOT_CHANNEL_MODE ?? CHANNEL_MODE.WHATSAPP).toLowerCase(),
    whatsappProtocolVersion: process.env.WHATSAPP_PROTOCOL_VERSION ?? '',
}

const parseWhatsAppVersion = (value = '') => {
    const parts = String(value)
        .split(',')
        .map((part) => Number(part.trim()))
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return [2, 3000, 1035824857]
    return parts
}

const normalize = (value = '') =>
    String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()

const isYes = (value = '') => ['sim', 'claro', 'ok', 'autorizo', 'aceito', 'pode'].some((item) => normalize(value).includes(item))
const isNo = (value = '') => ['nao', 'negativo', 'recuso', 'prefiro nao'].some((item) => normalize(value).includes(item))

const sendJson = (res, statusCode, payload) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
    return res.end(JSON.stringify(payload))
}

const sendHtml = (res, html) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(html)
}

const leadTemperatureMessage = (temperature) => {
    if (temperature === 'quente') return 'Seu interesse esta pronto para atendimento prioritario.'
    if (temperature === 'morno') return 'Voce esta quase pronto para agendar, nossa equipe vai ajudar com os detalhes.'
    return 'Vamos te orientar sem pressa para encontrar a melhor opcao.'
}

const createRuntimeContext = () => {
    const leadRepository = new InMemoryLeadRepository()
    const conversationRepository = new InMemoryConversationRepository()
    const aiAssistant = new GeminiAiAssistant()
    const safetyGuardService = new SafetyGuardService()
    const leadQualificationService = new LeadQualificationService()
    const catalogService = new MaeveCatalogService()
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
    const orchestratorService = new AiFirstConversationOrchestratorService({
        aiAssistant,
        catalogService,
        safetyGuardService,
    })
    const sandboxConversationService = new SandboxConversationService({
        conversationRepository,
        catalogService,
        orchestratorService,
        safetyGuardService,
        intakeLeadUseCase,
        handoffLeadUseCase,
    })

    return {
        repositories: { leadRepository, conversationRepository },
        services: { aiAssistant, safetyGuardService, catalogService, orchestratorService, sandboxConversationService },
        useCases: { intakeLeadUseCase, handoffLeadUseCase },
    }
}

const buildWhatsAppFlow = (context) => {
    const closingFlow = addKeyword(utils.setEvent('CLOSING_FLOW')).addAnswer(
        'Perfeito. Nossa equipe humana continua daqui. Quando quiser reiniciar, digite *agendar*.'
    )

    const emergencyFlow = addKeyword(['dor intensa', 'sangramento', 'falta de ar', 'infeccao', 'infecao', 'febre', 'necrose']).addAction(
        async (ctx, { flowDynamic, gotoFlow }) => {
            const objective = String(ctx.body ?? 'Relato de risco no chat').trim()
            const intake = await context.useCases.intakeLeadUseCase.execute({
                phoneNumber: ctx.from,
                name: 'Paciente',
                objective,
                preferredWindow: 'prioritario',
                consent: false,
                source: 'chat',
            })
            await context.useCases.handoffLeadUseCase.execute({
                leadId: intake.lead.id,
                reason: 'sinal_de_risco',
                requestedBy: 'flow',
            })
            await flowDynamic('Por seguranca, vou encaminhar para atendimento humano te acompanhar com prioridade.')
            return gotoFlow(closingFlow)
        }
    )

    const welcomeFlow = addKeyword(['oi', 'ola', 'olá', 'agendar', 'agenda', 'quero agendar', 'avaliacao'])
        .addAnswer(
            [
                'Oi, eu sou a assistente virtual da Maeve.',
                'Posso te ajudar a encontrar o cuidado ideal e agilizar seu atendimento.',
                'Tudo bem continuar? Responda *sim* ou *nao*.',
            ].join('\n'),
            { capture: true },
            async (ctx, { state, fallBack, gotoFlow }) => {
                if (isNo(ctx.body)) return gotoFlow(closingFlow)
                if (!isYes(ctx.body)) return fallBack('Responda com *sim* para continuar ou *nao* para encerrar.')
                await state.update({ entryConsent: true })
                return
            }
        )
        .addAnswer('Como posso te chamar?', { capture: true }, async (ctx, { state }) => {
            await state.update({ leadName: String(ctx.body ?? '').trim() })
        })
        .addAnswer('Me conta qual resultado ou cuidado voce busca hoje?', { capture: true }, async (ctx, { state, flowDynamic }) => {
            const message = String(ctx.body ?? '').trim()
            const decision = await context.services.orchestratorService.analyze({
                message,
                session: { state: 'DISCOVERY', leadDraft: {}, history: [], transientHistory: [] },
            })
            if (decision.intent === 'service_question' || decision.intent === 'price_question') {
                await flowDynamic(decision.reply)
            }
            await state.update({ leadObjective: message })
        })
        .addAnswer('Para quando voce gostaria de ser atendido(a)?', { capture: true }, async (ctx, { state }) => {
            await state.update({ preferredWindow: String(ctx.body ?? '').trim() })
        })
        .addAnswer(
            'Voce autoriza registrarmos esta conversa e seus dados para contato, agendamento e encaminhamento para a equipe Maeve? Responda *sim* ou *nao*.',
            { capture: true },
            async (ctx, tools) => {
                const { state, flowDynamic, gotoFlow, fallBack } = tools
                if (isNo(ctx.body)) {
                    await flowDynamic('Tudo bem. Sem consentimento, nao vou armazenar seus dados. Quando quiser, podemos recomecar.')
                    return gotoFlow(closingFlow)
                }
                if (!isYes(ctx.body)) return fallBack('Para continuar com seguranca, responda com *sim* ou *nao*.')

                const intake = await context.useCases.intakeLeadUseCase.execute({
                    phoneNumber: ctx.from,
                    name: String(state.get('leadName') ?? 'Paciente').trim() || 'Paciente',
                    objective: String(state.get('leadObjective') ?? 'avaliacao personalizada').trim(),
                    preferredWindow: String(state.get('preferredWindow') ?? 'nao informado').trim(),
                    consent: true,
                    source: 'chat',
                })
                await context.useCases.handoffLeadUseCase.execute({
                    leadId: intake.lead.id,
                    reason: 'lead_qualificado_whatsapp',
                    requestedBy: 'flow',
                })
                await flowDynamic(
                    [
                        `${intake.lead.name}, recebi seus dados e ja deixei tudo organizado para a equipe Maeve continuar seu atendimento.`,
                        leadTemperatureMessage(intake.lead.temperature),
                    ].join('\n')
                )
                return gotoFlow(closingFlow)
            }
        )

    return createFlow([emergencyFlow, welcomeFlow, closingFlow])
}

const noopFlow = addKeyword(utils.setEvent('SANDBOX_NOOP')).addAction(async () => {})
const buildSandboxFlow = () => createFlow([noopFlow])

const SANDBOX_CHAT_PAGE = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sandbox Chat - Maeve</title>
  <style>
    :root { color-scheme: light; --bg:#f5f7fb; --panel:#fff; --line:#d8e0ec; --text:#172033; --muted:#667085; --accent:#0f766e; --soft:#e8f6f5; --user:#eef5ff; }
    * { box-sizing: border-box; }
    body { margin:0; padding:24px; font-family: Segoe UI, Roboto, Arial, sans-serif; background:var(--bg); color:var(--text); }
    .wrap { max-width:1080px; margin:0 auto; display:grid; grid-template-columns: 1.2fr .8fr; gap:14px; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:16px; box-shadow:0 10px 24px rgba(20,32,52,.06); }
    h1 { margin:0 0 6px; font-size:22px; } p { margin:0; color:var(--muted); }
    label { display:block; font-size:12px; color:var(--muted); margin:12px 0 4px; }
    input, textarea, button { width:100%; border:1px solid var(--line); border-radius:8px; padding:10px 12px; font:inherit; }
    textarea { min-height:90px; resize:vertical; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .row { display:flex; gap:8px; margin-top:10px; } .row button { width:auto; cursor:pointer; }
    .primary { background:var(--accent); border-color:var(--accent); color:#fff; }
    .feed { height:58vh; overflow:auto; padding:8px; background:#fafcff; border:1px solid var(--line); border-radius:8px; white-space:pre-wrap; }
    .bubble { margin:8px 0; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:#fff; }
    .user { background:var(--user); border-color:#bad3ff; } .bot { background:var(--soft); border-color:#b8e3dc; }
    .meta { margin-top:8px; font-size:12px; color:var(--muted); }
    pre { margin:0; max-height:72vh; overflow:auto; white-space:pre-wrap; font-size:12px; }
    @media (max-width: 860px) { .wrap { grid-template-columns:1fr; } .grid { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <main class="panel">
      <h1>Sandbox Chat Maeve</h1>
      <p>Teste local da jornada com IA, catalogo, LGPD e handoff.</p>
      <div class="grid">
        <div><label for="from">Numero</label><input id="from" value="5565991112222" /></div>
        <div><label for="sessionId">Session ID</label><input id="sessionId" /></div>
      </div>
      <div class="grid">
        <div><label for="sourceCampaign">Campanha (opcional)</label><input id="sourceCampaign" placeholder="Ex: Anuncio laser" /></div>
        <div><label for="sourceUrl">URL origem (opcional)</label><input id="sourceUrl" placeholder="https://..." /></div>
      </div>
      <label for="sourceAd">Anuncio/referral (opcional)</label>
      <input id="sourceAd" placeholder="Texto do anuncio ou referral do WhatsApp" />
      <label for="message">Mensagem</label>
      <textarea id="message" placeholder="Digite: oi"></textarea>
      <div class="row">
        <button class="primary" id="sendBtn">Enviar</button>
        <button id="resetBtn">Resetar</button>
        <button id="newBtn">Nova sessao</button>
      </div>
      <div class="meta" id="stateMeta">Aguardando mensagens...</div>
      <div class="feed" id="feed"></div>
    </main>
    <aside class="panel">
      <h1>Debug</h1>
      <p>Estado, NLU, historico, lead e handoff.</p>
      <pre id="debug">{}</pre>
    </aside>
  </div>
  <script>
    const fromEl = document.getElementById('from');
    const sessionIdEl = document.getElementById('sessionId');
    const sourceCampaignEl = document.getElementById('sourceCampaign');
    const sourceAdEl = document.getElementById('sourceAd');
    const sourceUrlEl = document.getElementById('sourceUrl');
    const messageEl = document.getElementById('message');
    const feedEl = document.getElementById('feed');
    const debugEl = document.getElementById('debug');
    const stateMetaEl = document.getElementById('stateMeta');
    const addBubble = (kind, text) => {
      const box = document.createElement('div');
      box.className = 'bubble ' + kind;
      box.textContent = text;
      feedEl.appendChild(box);
      feedEl.scrollTop = feedEl.scrollHeight;
    };
    const postJson = async (url, body) => {
      const res = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Falha na requisicao');
      return data;
    };
    const updateDebug = (data) => {
      sessionIdEl.value = data.sessionId || sessionIdEl.value;
      stateMetaEl.textContent = 'state: ' + (data.state || '-') + ' | intent: ' + (data.nlu?.intent || '-') + ' | source: ' + (data.nlu?.source || '-') + ' | model: ' + (data.nlu?.modelUsed || '-') + ' | handoff: ' + (data.nlu?.handoff?.recommended ? 'sim' : 'nao');
      debugEl.textContent = JSON.stringify(data, null, 2);
    };
    const sendCurrentMessage = async () => {
      const msg = messageEl.value.trim();
      if (!msg) return;
      addBubble('user', msg);
      messageEl.value = '';
      try {
        const payload = {
          from: fromEl.value.trim(),
          message: msg,
          sessionId: sessionIdEl.value.trim() || null,
          sourceCampaign: sourceCampaignEl.value.trim() || null,
          sourceAd: sourceAdEl.value.trim() || null,
          sourceUrl: sourceUrlEl.value.trim() || null
        };
        const data = await postJson('/v1/simulate/message', payload);
        updateDebug(data);
        (data.messages || []).forEach((line) => addBubble('bot', line));
      } catch (error) {
        addBubble('bot', 'Erro: ' + error.message);
      }
    };
    document.getElementById('sendBtn').onclick = sendCurrentMessage;
    messageEl.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      await sendCurrentMessage();
    });
    document.getElementById('resetBtn').onclick = async () => {
      await postJson('/v1/simulate/reset', { from: fromEl.value.trim(), sessionId: sessionIdEl.value.trim() || null });
      addBubble('bot', 'Sessao resetada.');
    };
    document.getElementById('newBtn').onclick = () => {
      sessionIdEl.value = ''; messageEl.value = ''; feedEl.innerHTML = ''; debugEl.textContent = '{}';
      stateMetaEl.textContent = 'Nova sessao local.';
    };
  </script>
</body>
</html>`

const registerSandboxRoutes = ({ provider, handleCtx, context }) => {
    const renderSandbox = handleCtx(async (_bot, _req, res) => sendHtml(res, SANDBOX_CHAT_PAGE))
    provider.server.get('/sandbox', renderSandbox)
    provider.server.get('/', renderSandbox)

    provider.server.post(
        '/v1/simulate/message',
        handleCtx(async (_bot, req, res) => {
            try {
                const result = await context.services.sandboxConversationService.handleMessage(req.body ?? {})
                return sendJson(res, 200, result)
            } catch (error) {
                return sendJson(res, 422, { status: 'error', message: error.message })
            }
        })
    )

    provider.server.post(
        '/v1/simulate/reset',
        handleCtx(async (_bot, req, res) => {
            await context.services.sandboxConversationService.reset(req.body ?? {})
            return sendJson(res, 200, { status: 'ok', message: 'session_reset' })
        })
    )

    provider.server.get(
        '/v1/simulate/session',
        handleCtx(async (_bot, req, res) => {
            const session = await context.services.sandboxConversationService.getSession(req.query ?? {})
            if (!session) return sendJson(res, 404, { status: 'error', message: 'session not found' })
            return sendJson(res, 200, { status: 'ok', session })
        })
    )
}

class SandboxProvider extends ProviderClass {
    globalVendorArgs = {
        name: 'sandbox',
    }

    beforeHttpServerInit() {}

    afterHttpServerInit() {}

    busEvents() {
        return []
    }

    async initVendor() {
        return new EventEmitter()
    }

    async sendMessage() {
        return { status: 'sandbox_noop' }
    }

    async saveFile() {
        return ''
    }
}

const createProviderByMode = () => {
    if (env.channelMode === CHANNEL_MODE.SANDBOX) return createProvider(SandboxProvider, { name: 'sandbox' })
    return createProvider(Provider, { version: parseWhatsAppVersion(env.whatsappProtocolVersion) })
}

const registerApiRoutes = ({ provider, handleCtx, context }) => {
    provider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const payload = req.body ?? {}
            const number = String(payload.number ?? '')
            const message = String(payload.message ?? '')
            if (!number || !message) return sendJson(res, 400, { status: 'error', message: 'number and message are required' })

            try {
                await retry(() => bot.sendMessage(number, message, { media: payload.urlMedia ?? null }), { attempts: 3, delayMs: 500 })
                return sendJson(res, 200, { status: 'ok', message: 'sent' })
            } catch {
                return sendJson(res, 503, { status: 'error', message: 'failed to deliver after retries' })
            }
        })
    )

    provider.server.get(
        '/health',
        handleCtx(async (_bot, _req, res) =>
            sendJson(res, 200, {
                status: 'ok',
                service: 'chatbot-maeve',
                mode: env.channelMode,
                ai: {
                    configured: context.services.aiAssistant.isConfigured(),
                    model: context.services.aiAssistant.model,
                    fallbackModel: context.services.aiAssistant.fallbackModel,
                },
                uptimeSeconds: Math.floor(process.uptime()),
            })
        )
    )

    if (env.channelMode === CHANNEL_MODE.SANDBOX) registerSandboxRoutes({ provider, handleCtx, context })
}

const main = async () => {
    const context = createRuntimeContext()
    const provider = createProviderByMode()
    const flow = env.channelMode === CHANNEL_MODE.SANDBOX ? buildSandboxFlow() : buildWhatsAppFlow(context)
    const database = new Database()

    const { handleCtx, httpServer } = await createBot({ flow, provider, database })
    registerApiRoutes({ provider, handleCtx, context })
    httpServer(env.port)
}

main()
