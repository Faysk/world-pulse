# 06 — Modelo de dados preliminar (sem SQL final)

**Status:** modelo de domínio proposto; migration de domínio experimental no PR #31, ainda não aplicada em produção. Banco Neon e schema de acesso já provisionados.

**Atualização confirmada em 24/10/2026:** usar [saldo/expiração por participante e hashtag](14-time-credit-contract.md). `contributions` precisa de `expires_at` além do histórico de segundos creditados. Agregados ativos vêm dos pares com saldo positivo, não apenas de `participants.selected_hashtag_id`. Vários pares do mesmo participante podem ter saldo simultâneo. A proposta original abaixo deve ser lida com essa correção; o provedor implantado é Neon PostgreSQL.

Os nomes abaixo são do domínio proposto. O draft #31 usa `tags`, `visitors`, `visitor_tags` e `tap_batches`; o PR #43 acrescentou `expires_at` na migração `0003`, validada em PostgreSQL descartável. As migrações `0002`/`0003` continuam sem aplicação em produção.

## Entidades

### `hashtags`

- `id` UUID/identificador
- `slug_normalized` único (ex.: `gta6`)
- `label` (ex.: `#GTA6`)
- `color_hex` cor aleatória sorteada **somente na primeira criação**
- `created_at`

A inserção deve ser atômica: duas pessoas criando o mesmo # simultaneamente compartilham a **mesma** cor persistida. Não ressortear.

### `participants`

- `id` pseudônimo estável (modelo a validar)
- `selected_hashtag_id` **0 ou 1 hashtag selecionada**, nunca duas
- `country_code` (quando disponível)
- `geo_cell` área aproximada (quando disponível)
- `first_seen_at` / `last_seen_at`

`participants` significa **identificadores reconhecidos**, não identidade humana comprovada. Localização pode mudar; não guardar histórico de trajetórias individuais.

### `contributions`

- `participant_id` + `hashtag_id` (par único)
- `seconds_total` inteiro não negativo (incrementos em +1 por tap)
- `expires_at` expiração do saldo cronológico; saldo = máximo de zero e expiração menos relógio do servidor
- `updated_at`

**Trocar # não limpa nem move os segundos passados.**

### `contribution_batches` (opção recomendada)

- `batch_id` único por requisição de sincronização
- `participant_id`, `hashtag_id`, `tap_count`, `created_at`

Protege contra reenvio de lote. Avaliar retenção/deduplicação compacta para não crescer para sempre.

### `region_activity` (derivada/materializada, opcional no MVP)

- `geo_cell` e resolução
- `hashtag_id`
- `participant_count` de **participantes distintos**; **nunca soma de segundos**
- `computed_at`

Agregação espacial ativa deve ser derivada dos pares participante/hashtag com saldo positivo, unidos à região aproximada autorizada. Não atualizar coordenadas nem gravar o saldo a cada segundo.

## Invariantes essenciais

1. Uma hashtag tem uma única cor estável global.
2. Um participante possui **no máximo uma hashtag selecionada** de cada vez.
3. `seconds_total` somente aumenta com taps válidos ou ajustes explícitos.
4. A quantidade no campo espacial conta **participantes distintos por hashtag com expires_at futuro**, nunca `SUM(seconds_total)`. Um participante pode contar em várias hashtags com saldo positivo.
5. A troca de hashtag não altera contribuições históricas das demais.
6. Lotes reprocessados não duplicam o total.
7. Nenhuma API de agregados públicos expõe IDs individuais ou localização exata.
8. `seconds_total` registra **segundos creditados**, não duração de uma sessão.

## Queries/visões pretendidas

- `top_hashtags` — Top 10 por **métrica ainda a definir** (participantes com saldo positivo, participantes históricos ou segundos).
- `top_hashtags_counters` — `participants_ever`, `participants_present` (se houver regra de validade), `seconds_total`.
- `hashtag_origin_by_country` — quantidade agregada por país para cada hashtag.
- `globe_density_by_cell` — participantes distintos por # e célula geográfica/resolução.

## Pendências antes das migrations

- Definir participante persistente sem login (ID anônimo local + limitações).
- Implementar expiração pelo saldo confirmado no contrato #14 da documentação; histórico permanece separado.
- Participação visual requer saldo positivo originado de taps; selecionar uma hashtag sozinha não cria crédito.
- Definir métrica do Top 10 e regra de atualização da origem.
- Definir se atribuição de país registra origem inicial, atual ou última conhecida (sem rastrear trajetos pessoais).
- Definir retenção diferenciada para identificadores, agregados e segundos.
