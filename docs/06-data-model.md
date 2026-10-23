# 06 — Modelo de dados preliminar (sem SQL final)

**Status:** proposta de domínio; nenhuma tabela criada no Supabase.

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

Agregação espacial deve ser derivável de `participants` ou snapshot explícito. Não atualizar a célula a cada tap.

## Invariantes essenciais

1. Uma hashtag tem uma única cor estável global.
2. Um participante possui **no máximo uma hashtag selecionada** de cada vez.
3. `seconds_total` somente aumenta com taps válidos ou ajustes explícitos.
4. A quantidade de pessoas no campo espacial é calculada a partir de **participantes distintos**, nunca `SUM(seconds_total)`.
5. A troca de hashtag não altera contribuições históricas das demais.
6. Lotes reprocessados não duplicam o total.
7. Nenhuma API de agregados públicos expõe IDs individuais ou localização exata.
8. `seconds_total` registra **segundos creditados**, não duração de uma sessão.

## Queries/visões pretendidas

- `top_hashtags` — Top 10 por **métrica ainda a definir** (pessoas distintas ou presença selecionada).
- `top_hashtags_counters` — `participants_ever`, `participants_present` (se houver regra de validade), `seconds_total`.
- `hashtag_origin_by_country` — quantidade agregada por país para cada hashtag.
- `globe_density_by_cell` — participantes distintos por # e célula geográfica/resolução.

## Pendências antes das migrations

- Definir participante persistente sem login (ID anônimo local + limitações).
- Definir duração ou expiração da presença visual; segundos são históricos.
- Definir se participação visual requer ao menos um tap ou apenas seleção da hashtag.
- Definir métrica do Top 10 e regra de atualização da origem.
- Definir se atribuição de país registra origem inicial, atual ou última conhecida (sem rastrear trajetos pessoais).
- Definir retenção diferenciada para identificadores, agregados e segundos.
