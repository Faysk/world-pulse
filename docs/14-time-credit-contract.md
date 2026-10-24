# 14 — Saldo de tempo e manchas persistentes

**Decisão confirmada pelo usuário em 24/10/2026.** Substitui propostas de presença online/heartbeat ou expiração fixa de cinco minutos. Rastreio: #9, #5, #20 e #8.

## Regra do produto

Cada tap elegível adiciona um segundo ao saldo da hashtag selecionada. O saldo diminui com a passagem do tempo, mesmo quando o navegador está fechado. A participação naquela hashtag permanece até o saldo zerar. Voltar ao site não reinicia, congela nem apaga esse saldo.

Uma pessoa pode manter **várias hashtags com saldo simultaneamente**. Ela aumenta apenas a hashtag selecionada em cada operação de contribuição. Ao mudar A→B, o saldo de A continua diminuindo e pode continuar gerando sua mancha; os novos taps aumentam B. Ao voltar para A, acrescenta ao saldo que ainda existir. Não existe exclusividade de presença entre hashtags, apenas exclusividade do destino dos novos taps.

Exemplo confirmado: a pessoa acumula oito horas e sai. Quando retorna, faltam 32 minutos. Pode acrescentar um minuto em taps e ficar com 33 minutos naquela hashtag, ou selecionar outra hashtag enquanto os 32 minutos continuam correndo na anterior.

## Contagem de pessoas e histórico

Para a hashtag H, um pseudônimo conta **uma vez** enquanto seu saldo em H for positivo. Taps prolongam a duração dessa participação; não multiplicam pessoas nem aumentam diretamente o peso/raio da mancha. Um pseudônimo pode contar em H1 e H2 se ambos os saldos forem positivos. Por isso, somar participantes de hashtags diferentes não produz uma contagem global de pessoas únicas.

Manter separados:

- `seconds_credited_total`: histórico dos segundos creditados, monotônico após deduplicação dos lotes.
- `expires_at`: instante de expiração do saldo atual para o par participante/hashtag.
- `remaining_ms = max(0, expires_at - server_now)`: saldo restante derivado, não um contador atualizado por segundo no banco.

O histórico não é saldo disponível: ter creditado oito horas ontem não significa ter oito horas restantes hoje. Ao expirar, a participação sai dos agregados; o histórico individual é consolidado após mais de 30 dias sem retorno e todos os
saldos zerados, preservando totais por hashtag ([retenção](27-retention-policy.md)).
O Top 10 ordena participações atuais por saldo positivo, nunca visitantes online
ou segundos; nome normalizado/ID desempatam ([ranking](24-ranking-contract.md)).

## Cálculo e concorrência

Ao aceitar um lote de N taps, aplicar atomicamente:

```text
expires_at = max(expires_at_anterior, server_now) + N segundos
seconds_credited_total += N
```

Se não há saldo anterior ou ele expirou, a base é `server_now`. Não conceder crédito duplicado num retry. A chave idempotente e a atualização do saldo precisam estar na mesma transação; bloquear/atualizar atomicamente o par participante/hashtag para evitar perdas em lotes concorrentes.

A API usa relógio do servidor. O browser pode interpolar o contador para exibição a partir de `server_now` e `expires_at`, mas mudar o relógio local não altera a participação. Lote atrasado pertence à hashtag original, nunca à seleção atual no instante de recepção. O primeiro corte pode creditar quando o servidor aceita o lote; se for necessário creditar retroativamente taps offline, isso exige política e evidência próprias em #5, não timestamps arbitrários enviados pelo cliente.

Não precisamos de heartbeat por visitante nem de writes por segundo para manter manchas. Consultas/agregados usam `expires_at > server_now`; o frontend atualiza visualmente pelos snapshots recebidos. Fechar a aba não exige `unload` para remover presença. Isso reduz chamadas, mas exige índices e uma política de cache/atualização dos agregados (#6/#8).

## Implementação entregue e limites

`src/timeCredit.ts` contém os cálculos puros de expiração, recarga e crédito somente para a seleção atual. Testes cobrem oito horas→32 minutos, recarga, expiração/reinício, múltiplas hashtags, ausência de seleção e entradas inválidas/overflow.

A experiência integrada e a API estão na main pelo PR #31: sessão pseudônima,
transações idempotentes, seleção, múltiplos saldos, retomada e fila entre abas
foram testadas com PostgreSQL descartável e HTTPS privado contra Neon staging
real. O crédito durável é aplicado no servidor; `timeCredit.ts` não substitui a
transação do banco. A POC pública ainda usa demonstração sintética/local, pois
alpha/API/geografia estão desligadas e a publicação segue pausada.

[Experiência](29-live-experience.md), [prova HTTPS privada](35-staging-private-https-smoke.md)
e [gates restantes](36-prepublication-status.md) distinguem implementação validada
de aceite público. Não afirmar persistência pública já ativada.
