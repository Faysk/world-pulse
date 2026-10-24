# 26 — Estrutura real e prontidão da participação

Atualizado em 24/10/2026. O código de participação está na cadeia do draft #31;
os controles abaixo não significam ativação no domínio público.

## Caminhos reais

```mermaid
flowchart LR
  P[Site público: demo sintética] --> T[OpenFreeMap]
  L[Laboratório DEV-only] --> H[Handlers HTTP: cookie e origem]
  H --> B[Orçamento compartilhado]
  B --> D[(PostgreSQL)]
  C[Actions: PostgreSQL descartável] --> L
  G[GitHub Environment staging] --> S[(Branch Neon staging)]
  R[GitHub Environment production] --> V[Publicação manual Vercel]
```

O browser não recebe conexão SQL, token Vercel ou chave R2. R2 é privado e não
participa do fluxo de taps; não há motivo atual para enviar cada clique para
objetos. O feed Steam permanece no código e oculto da experiência pública.

## Tabelas do código experimental

| Tabela em `world_pulse` | Função |
|---|---|
| `tags` | Nome normalizado único e cor persistida uma vez |
| `visitors` | Hash do cookie pseudônimo, seleção atual, último retorno e validade renovável |
| `visitor_tags` | Par único sessão/hashtag, histórico de segundos e expiração do saldo |
| `tap_batches` | ID/fingerprint e taps de cada lote para idempotência |
| `operation_budgets` | Até cinco contadores compartilhados de capacidade, sem dados de localização |
| `tag_history_totals` | Histórico consolidado por hashtag sem vínculo individual |

Nenhuma dessas tabelas contém IP, GPS, cidade ou trajetória. O modelo ainda não
implementa a geografia pública. Histórico começa na seleção; presença atual
exige saldo positivo. A política de retenção foi aprovada: após 30 dias sem
retorno e todos os saldos zerados, soma-se no rollup e só então remove-se a
sessão na mesma transação. DELETE/CASCADE isolado perderia histórico e é proibido.

## Ambientes

| Ambiente | Estado |
|---|---|
| Produção Neon `main` | Baseline de acesso; domínio da API não migrado/ativado por este trabalho |
| Neon `world-pulse-staging` | Separado, schema-only, credenciais próprias no GitHub; 0001–0005 e timeouts transacionais no pooler verificados. Expira 31/10 às 01:15 UTC |
| CI PostgreSQL descartável | Migrações 0001–0005; testes HTTP/duas sessões/abas e concorrência, sem secrets reais |
| Local visual | Funciona sem secrets; teste SQL requer PostgreSQL descartável do CI ou instalação local explícita |

0004/0005 foram aplicadas no staging pelo Actions; qualquer migração futura exige operação manual revisada;
deploy não aplica SQL. `check` não recebe proprietário; `migrate` recebe esse
segredo apenas no passo deliberado. O script fixa endpoint, roles, banco, TLS
e expiração, recusando atingir produção por engano.

## Implementado sem depender de Vercel

- Transporte e interface isolados para selecionar, adicionar, sincronizar,
  restaurar saldos e explicar falhas sem inventar créditos.
- Cookie HttpOnly e binding verificado em cada lote: rotação não transfere taps
  antigos a outra sessão; fila órfã entra em quarentena com descarte explícito.
- Web Locks e envelope v3 coordenam escritores entre abas; lote congelado antes
  do fetch, idempotência no banco e recuperação após encerramento da aba.
- Ranking atual separado do histórico, contagem por pares distintos, sem peso
  ou desempate por segundos. Snapshot com relógio do servidor e polling explícito.
- Limpeza limitada de IDs de lotes de sessões já expiradas há mais de 24h,
  preservando histórico; rotina não agendada em produção.
- Orçamentos globais compartilhados, limites de filas/lotes e timeouts de queries.

## O que ainda impede a alpha pública

1. Staging HTTPS integrado e sincronização GitHub → preview; teste do pooler,
   cookies protegidos, duas sessões e retries no ambiente remoto.
2. Verificar a fonte geográfica na borda remota e revisar privacidade. A [implementação
   country-only](31-country-geography.md) agrega no SQL com consentimento e fonte fechada
   por padrão; testes locais não comprovam headers reais do provedor.
3. Validar a operação/agendamento monitorado da retenção já aprovada, backups/logs
   do provedor e informação ao usuário. [Política e limites](27-retention-policy.md).
4. Verificar os polígonos por hashtag da [experiência integrada](29-live-experience.md)
   em homologação remota. Composição multicolor orgânica (#32) ainda é etapa própria.
5. Medidas de tráfego/custo no provedor e benchmark em hardware físico. Contador
   no banco não impede DDoS nem garante que o plano gratuito nunca esgote.

Issues antigas: #11 (base React) concluída; #1 (três motores) encerrada como não
planejada, sem fingir benchmark. #12 conserva QA real/hardware. Não fechar #5,
#6, #7, #8 ou #13 apenas porque testes locais passaram.

Referências: [fila](23-cross-tab-queue.md), [ranking](24-ranking-contract.md),
[orçamentos](25-api-operation-budgets.md), [staging](18-remote-staging.md).


[Benchmark CPU completo](28-population-benchmark.md): 180 combinações incluindo 8 bilhões; não é benchmark de usuários simultâneos ou GPU.
