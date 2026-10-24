# 24 — Participação atual, histórico e ranking

Decisão do usuário em 24/10/2026, issue #8 / milestone v0.4.

## Regra fechada

- Ranking atual = sessões pseudônimas distintas por hashtag com saldo positivo.
- 1 sessão em #gta6 = 1 participação atual, tenha 1 segundo ou 8 horas.
- A mesma sessão pode contar também em #rdr2 enquanto ambas tiverem saldo.
- Quando o saldo zera, a participação sai do ranking atual e da mancha.
- Criar/selecionar uma hashtag registra histórico imediatamente, sem depender de
  taps. Selecionar outra vez não duplica esse par sessão/hashtag.
- Seleção sem saldo positivo registra histórico, mas não inventa segundos nem
  cria presença atual. O primeiro tap válido inicia o saldo.
- Máxima histórica é uma possível métrica futura, distinta da participação
  atual e do total de pares registrados; não foi implementada nem simulada.

O MVP identifica navegadores por cookie, não pessoas físicas comprovadas.
Várias sessões/dispositivos podem representar a mesma pessoa. A interface deve
usar participações/sessões até existir uma forma adequada de deduplicação.

## Contratos separados

`GET /api/ranking` e o alias `GET /api/activity` retornam `type=active`, `asOfMs`,
`metric=distinct_anonymous_sessions_with_positive_balance`, `geography=unavailable`
e até 10 hashtags. Cada linha inclui `activeParticipants`, `historicalParticipants`
e `creditedSeconds` como strings decimais para não perder precisão de bigint.

Ordenação: participações atuais desc, nome normalizado asc e ID asc. Segundos e
participações históricas NÃO desempatarão o ranking atual. Todas as hashtags
podem disputar, sem mínimo; ausência de participação atual aparece como zero.

`GET /api/history` retorna `type=historical`, pares sessão/hashtag já selecionados
e segundos históricos. Esse histórico também não é uma máxima simultânea.
A antiga resposta histórica de `/api/ranking` foi movida para essa rota enquanto
a API ainda estava em draft/gated, antes de haver consumidor público. Agora a API
está integrada à main, mantendo flags públicas desligadas.

## Interface de homologação

A experiência integrada gated e o laboratório DEV-only exibem o Top 10 do banco
configurado, separados da demonstração sintética. Polling a cada 5 segundos apenas com aba visível, sem requests
sobrepostos. A hora da leitura é explícita; falha preserva a última leitura e
mostra que pode estar desatualizada. Não inventa zero para mascarar indisponibilidade.
Isso é atualização periódica, não transmissão instantânea por WebSocket.

## Verificação e pendências

Testes de contrato, PostgreSQL descartável e cliente verificam contagem inicial
no histórico, re-seleção sem duplicação, 30 taps = 1 participação, múltiplos
saldos, expiração e desempate independente de segundos. UI desktop/mobile
verifica contagens e estados de leitura.

Geografia agregada por país, consentimento, supressão, cache e orçamentos estão
implementados e testados, com [países multicolor/foco/busca](38-multicolor-countries.md).
O [HTTPS privado contra Neon real](35-staging-private-https-smoke.md) também passou.

Ainda pendentes: fonte geográfica na borda real, preview/runtime Vercel (#53),
custos/logs/backup/restore e operação de produção (#7/#13), visual orgânico e QA
físico (#32/#12). Nenhuma ativação ou migração de domínio foi feita em produção.
[Estado operacional atual](36-prepublication-status.md).
