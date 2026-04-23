# HANDOFF

## 2026-04-23 14:33 (America/Cuiaba)
- Branch: `codex/railway-sandbox-provider-fix`
- PR: `https://github.com/brunolimaff-jpg/chatbot/pull/4`

### Mudancas implementadas
- Correcao do crash em `CHATBOT_CHANNEL_MODE=sandbox` substituindo `TestTool.TestProvider` por provider sandbox proprio com `initVendor()` valido.
- Adicao de `src/infrastructure/providers/sandbox.provider.ts` com vendor baseado em `EventEmitter`.
- Inclusao de carregamento automatico de variaveis via `dotenv/config`.
- Inclusao de launchers Windows para execucao simplificada:
  - `run-chatbot.bat`
  - `run-sandbox.bat`
  - `run-whatsapp.bat`
- Adicao dos perfis de ambiente:
  - `.env.example`
  - `.env.sandbox`
  - `.env.whatsapp`
- Atualizacao de `README.md` com instrucoes de execucao facil no Windows.

### Riscos e impactos
- Modo `sandbox` deixa de depender do provider de teste interno do BuilderBot, reduzindo risco de crash no Railway.
- Modo `whatsapp` permanece sem alteracao funcional de fluxo.

### Proximos passos priorizados
1. Ajustar a variavel `CHATBOT_CHANNEL_MODE` no Railway por ambiente (`sandbox` homologacao, `whatsapp` producao).
2. Validar `GET /health` e `POST /v1/simulate/message` no ambiente de homologacao.
3. Considerar fixar Node `20.x` no Railway para padrao LTS.

### Pendencias abertas
- Confirmar se os arquivos `.bat` devem permanecer no repositorio ou migrar para pasta `scripts/`.

## 2026-04-23 14:10 (America/Cuiaba)
- Branch: `codex/clinic-chatbot-mvp-pr`
- PR: `https://github.com/brunolimaff-jpg/chatbot/pull/3`

### Mudancas implementadas
- Correcao de erro de referencia no sandbox (`copy.close` -> `conversationCopy.close`).
- Remocao de mutacao de estado compartilhado no handoff para evitar risco de concorrencia; `targetNumber` passou a ser carregado por payload.
- Atualizacao do `scripts/check-structure.mjs` para analise de funcoes via AST TypeScript (sem heuristica por regex/braces).
- Externalizacao opcional da versao do protocolo WhatsApp (`WHATSAPP_PROTOCOL_VERSION`) com fallback para versao padrao do provider.
- Endurecimento da configuracao SSL do Postgres com controles por env:
  - `DATABASE_SSL_MODE=auto|require|disable`
  - `DATABASE_SSL_REJECT_UNAUTHORIZED=true|false`
  - `DATABASE_SSL_CA=<ca-pem>`
- Refino do fluxo WhatsApp para reduzir tamanho de funcoes e manter limite anti-god.

### Riscos e impactos
- Mudanca no comportamento SSL do Postgres pode exigir ajuste de variaveis em ambientes com certificados self-signed.
- Fluxo de handoff agora depende do destino resolvido por payload/gateway; testes de regressao de roteamento devem ser mantidos.

### Proximos passos priorizados
1. Responder threads do PR #3 com referencia ao commit de correcao.
2. Validar em Railway com `DATABASE_SSL_MODE` e `DATABASE_SSL_REJECT_UNAUTHORIZED` compativeis com o ambiente real.
3. Adicionar teste unitario cobrindo override de `targetNumber` no `DispatchHandoffUseCase`.

### Pendencias abertas
- Definir valor padrao de `WHATSAPP_PROTOCOL_VERSION` por ambiente (fixo via env ou auto sempre).
- Avaliar adicao de CA dedicada via `DATABASE_SSL_CA` em producao.

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
