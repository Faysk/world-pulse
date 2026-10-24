# 19 — Prévia de ranking por saldo ativo (issue #8)

**Estado:** rota e consulta SQL experimentais na branch da API, **não lançadas no World Pulse público**.

## Por que separar o ranking

O histórico de toques e a presença temporal respondem a perguntas diferentes:

- `activeParticipants` = quantos pseudônimos distintos possuem **saldo positivo** naquela hashtag no instante único `statement_timestamp()` do SQL, independentemente de qual hashtag selecionaram depois.
- `historicalParticipants` = quantos pseudônimos já tiveram um lote válido naquela hashtag, mesmo depois da expiração.
- `creditedSeconds` = soma histórica de taps idempotentes. **Nunca usar esta soma para dimensionar manchas**.

O mesmo pseudônimo pode estar ativo em duas hashtags ao mesmo tempo se ambos os saldos forem positivos; isso é intencional pelo contrato [#14](14-time-credit-contract.md).

## Endpoint experimental

`GET /api/activity` exige `WP_API_ENABLED=true` **no servidor** e responde `503 participation_disabled` caso contrário. Não é uma API pronta para lançamento público.

Formato:

```json
{
  "type": "active_balance_preview",
  "asOfMs": 1790000000000,
  "metric": "distinct_anonymous_sessions_with_positive_balance",
  "geography": "unavailable",
  "ranking": [
    {
      "id": "uuid",
      "name": "#gta6",
      "color": "#ff8758",
      "activeParticipants": "2",
      "historicalParticipants": "4",
      "creditedSeconds": "540"
    }
  ]
}
```

`asOfMs` é metadado do momento da consulta **ilustrado no exemplo**, não um valor retornado fixamente. Os números do exemplo são fictícios, e nenhum deles foi publicado.

Sem parâmetro de filtro: todas as tags competem. Ordenação **proposta para teste**: participantes ativos decrescente → participantes históricos decrescente → nome alfabético → ID. O Top 10 inclui hashtags com zero atividade se ainda houver vagas. Não existe corte de 10/100 pessoas. **A métrica final de ordenação do produto continua pendente de aprovação da issue #8.**

## Sem geografia nesta fase

Esta resposta **não** inclui país, cidade, coordenadas, IP, pseudônimo ou qualquer ID de visitante. `id` identifica **a hashtag**, não o participante. `geography: unavailable` é explícito, sem inferir origem. Origem por país e polígonos com privacidade são outra entrega na [#6](https://github.com/Faysk/world-pulse/issues/6).

A implementação usa uma consulta agregada SQL com `LEFT JOIN` e um `statement_timestamp()` por request; não depende de heartbeat ou gravação periódica no banco. Criação de hashtag sem nenhum tap conta zero; muitos taps de uma sessão continuam valendo **uma** sessão.

## Aceite do slice

- [x] Backend e contrato versionados, com gate desligado por padrão.
- [x] Teste de endpoint valida forma, não vazamento de IDs/geo e status 503/405.
- [x] Teste de integração PostgreSQL descartável: seleção sem tap = 0; 1 vs 30 taps = 2 participantes; saldo expirado sai do ativo mas permanece histórico; retry não reativa; mesmo visitante pode estar ativo em A e B.
- [ ] Confirmar execução de CI, SQL e Playwright.
- [ ] Decidir origem geográfica segura, métrica final e política de retenção antes de exibir na UI pública.
- [ ] Testar escala e cache de agregados fora do banco CI antes de lançar.

**Este endpoint não é a integração final #13.** A presença ainda representa sessões anônimas reconhecidas, não pessoas humanas verificadas.
