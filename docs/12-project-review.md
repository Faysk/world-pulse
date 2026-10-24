# 12 — Revisão crítica e próxima entrega

**Atualizado em 24/10/2026.** Rastreio: #20, #31, #32 e #37. Substitui a revisão histórica anterior à publicação.

## Situação

O frontend simulado está publicado. Neon, R2 e DNS estão provisionados e verificados pelo Actions. A publicação já usa candidata isolada, smoke de assets, revogação e promoção; não é trabalho futuro. [Estrutura implantada](05-free-tier-architecture.md).

A API do PR #31 está em draft e separada de `main`. Tem testes de sessão, cores e idempotência em PostgreSQL descartável, mas isso não significa que a aplicação já esteja conectada ao banco de produção. A migração de domínio não foi aplicada.

## Prioridade de produto

Entregar um fluxo real pequeno com dois navegadores antes de adicionar serviços, shaders ou carga sintética maior. Não usar R2 no fluxo apenas porque está disponível.

O [contrato de saldo](14-time-credit-contract.md) está confirmado: cada tap adiciona um segundo, o saldo diminui inclusive offline e várias hashtags podem manter manchas simultaneamente. Seleção exclusiva se aplica aos novos taps, não à existência de saldos anteriores. Não implementar presença por heartbeat/cinco minutos.

## Bloqueios concretos da API

Na revisão inicial do PR #31, `visitor_tags` armazena `seconds` históricos, mas não `expires_at`. O ranking é explicitamente histórico. Antes de integrar o cliente é necessário persistir/retornar saldo cronológico e testar que retry não estende a expiração. Não habilitar manchas reais usando contagens históricas.

A seleção global por navegador e os lotes atrasados precisam de contrato coerente: o lote conserva sua hashtag original, não muda a seleção atual, e não permite usar retries para criar crédito adicional. Definir janela/retenção antes de limpar IDs de idempotência.

Retenção, custo e abuso global ainda precisam de política. Limitar apenas taps por sessão não limita criação ilimitada de sessões. Manter o gate desligado até validar o corte e seus limites.

## Geografia e visual

Localização por IP não comprova bairro nem residência. Precisão da cartografia não justifica expor precisão dos participantes. Resolver regiões pequenas e sinal desconhecido em #6 antes de dados reais no mapa.

A bateria de cenários já mostrou saturação em alta densidade e competição de cores sobrepostas. #32 trata agregação por zoom e composição; [evidência](15-population-scenarios.md). Medir em celular físico (#12), com mapa real. Não inferir FPS de aparelho a partir do Chromium emulado.

## Planejamento

Algumas issues mantêm checklists históricos já superados; atualizar com evidência sem fechar etapas ainda pendentes. Milestones não devem impor dependência impossível: hashtags persistentes (#4) exigem API/banco (#5/#20), independentemente do número da versão.

A métrica do ranking (#8) continua aberta. Até defini-la, não apresentar ranking histórico experimental como ranking final do produto. A revisão atual recomenda participantes com saldo positivo, mas isso permanece proposta.
