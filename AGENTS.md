# AGENTS

Guia operacional para agentes Codex neste repositorio.

## Objetivo do produto
- Evoluir um chatbot de clinica de estetica focado em conversao para agendamento via WhatsApp.
- Priorizar seguranca, clareza, confiabilidade operacional e velocidade de entrega.

## Regras de execucao
- Sempre manter arquitetura em camadas (dominio, aplicacao, infraestrutura).
- Nunca oferecer diagnostico medico no fluxo automatizado.
- Sempre exigir consentimento explicito para uso de dados de contato.
- Sempre prever fallback para atendimento humano quando houver risco clinico, ambiguidade alta ou falha tecnica.
- Antes de finalizar qualquer mudanca de codigo, executar `npm run lint`, `npm run test` e `npm run build`.

## Arquitetura obrigatoria para IAs (anti-god)
- E proibido criar `god component` ou `god file`.
- Limite maximo para arquivos em `src/*`: 250 linhas.
- Limite maximo para `src/app.ts`: 180 linhas.
- Limite maximo por funcao/metodo: 40 linhas.
- Cada modulo deve ter responsabilidade unica (SRP).
- Regras de dominio nao podem ficar misturadas com rotas HTTP, provider ou bootstrap.
- Qualquer codigo criado e nao utilizado no mesmo ciclo deve ser removido antes de abrir PR.

## Regra de sensibilidade para skills e pesquisa externa
- Para qualquer nova tarefa, avaliar se as skills locais sao suficientes.
- Se houver lacuna de conhecimento, risco de retrabalho ou incerteza de abordagem, pesquisar no GitHub por skills relevantes.
- Priorizar pesquisa em repositorios de skills consolidados (por exemplo `openai/skills`, `wondelai/skills`) antes de inventar processo novo.
- Ao encontrar skill relevante:
  - explicar por que ela ajuda na tarefa;
  - propor aplicacao objetiva no contexto do repo;
  - se necessario, sugerir instalacao da skill e seguir com a implementacao.
- Nao pesquisar por padrao em toda tarefa simples; pesquisar quando isso aumentar qualidade, velocidade ou reduzir risco.

## Padrao de entrega
- Mudancas pequenas e incrementais.
- Commits com objetivo claro.
- PR com resumo de impacto funcional, risco, validacao e proximos passos.
- Todo PR deve atualizar `HANDOFF.md` com:
  - data/hora (America/Cuiaba), branch e link do PR;
  - mudancas implementadas;
  - riscos e impactos;
  - proximos passos priorizados;
  - pendencias abertas.
- Fluxo operacional e GitHub-first: o repositorio remoto e a fonte de verdade, local e apenas ambiente de implementacao e subida.
