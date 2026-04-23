# HANDOFF

## 2026-04-23 14:30 (America/Cuiaba)
- Branch: `codex/clinic-chatbot-mvp-pr`
- PR: `https://github.com/brunolimaff-jpg/chatbot/pull/2`

### Mudancas implementadas
- Refatoracao de `src/app.ts` para bootstrap enxuto.
- Separacao de responsabilidades em modulos de bootstrap, fluxo WhatsApp e rotas HTTP.
- Adicao de modo `sandbox` via `CHATBOT_CHANNEL_MODE=sandbox`.
- Inclusao de endpoints de simulacao:
  - `POST /v1/simulate/message`
  - `POST /v1/simulate/reset`
  - `GET /v1/simulate/session`
- Criacao de maquina de estados de conversa para validacao de fluxo sem WhatsApp.
- Padronizacao de erros de API em `{ status, message, code }`.
- Atualizacao das instrucoes de IA em `AGENTS.md` com regras anti-god e processo GitHub-first.

### Riscos e impactos
- O modo `sandbox` usa fluxo de simulacao dedicado; comportamento pode divergir do provider WhatsApp em cenarios nao cobertos por teste.
- Persistencia em Postgres/Redis depende de variaveis e disponibilidade da infraestrutura; fallback para memoria foi mantido.

### Proximos passos priorizados
1. Validar o fluxo completo no modo `sandbox` com cenarios reais de conversa.
2. Ajustar copy das mensagens com base na taxa de continuidade por etapa.
3. Revalidar no modo `whatsapp` e comparar comportamento com o `sandbox`.
4. Criar dashboard simples de funil (entrada > consentimento > handoff).

### Pendencias abertas
- Confirmar se o endpoint de simulacao deve suportar injecao de audio transcrito no mesmo contrato.
- Definir estrategia de versionamento de copy (arquivo de catalogo vs hardcode em modulo).
