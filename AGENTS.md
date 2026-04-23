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
