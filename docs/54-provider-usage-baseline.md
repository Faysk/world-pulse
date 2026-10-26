# 54 — Primeira linha de base nos provedores

26/10/2026 · #7 / #147 / #138 · leitura sem upgrade ou novo serviço.

## Vercel — somente World Pulse

Fonte: [Usage do projeto](https://vercel.com/projeto-desenv-6905s-projects/world-pulse/usage),
filtrado por world-pulse, plano Hobby. Janela exibida: Last 30 Days,
“Sep 26, 12pm – Oct 26, 1pm”. Não inferir timezone dessa legenda.
A UI alerta que os dados podem ter até uma hora de atraso.

| Métrica exibida | Valor |
| --- | --- |
| Function Invocations | 11.196 |
| Fluid Active CPU | 4 min 50 s |
| Fluid Provisioned Memory | 5,8 GB-h |
| Fast Data Transfer (entrada + saída) | 130,39 MB |
| Fast Data Transfer — saída | 108,22 MB |
| Fast Origin Transfer (entrada + saída) | 15,86 MB |
| CDN Requests (arredondado pela UI) | 13 mil |

São totais do **projeto**, incluindo seus previews/testes; não uma amostra de
usuários orgânicos ou exclusivamente produção. Não confundir as 11.196 invocações
com participantes ou com ausência de HTTP 429. A lista inicial da conta continha
outros projetos e números maiores: esses totais foram deliberadamente excluídos
desta atribuição. Quotas exibidas na visão de projeto são alocações do plano,
não uma reserva isolada para este projeto nem autorização para gastar.

## Neon — projeto com produção e staging

Fonte: [Branch overview / Usage](https://console.neon.tech/app/projects/dry-glade-70562330/branches/br-long-mountain-zaoh0284),
projeto world-pulse-production, Free, duas branches. A seção Usage informa
“Since Oct 23, 2026”; não trataremos esses valores como produção isolada.

| Métrica exibida | Valor |
| --- | --- |
| Compute | 2,23 CU-h |
| Storage | 32,54 MB |
| History | 5,54 MB |
| Network transfer | 6,1 MB |
| Default compute configurado | 0,25 CU |
| History retention configurada | 6 h |

No monitoramento da branch main, o compute estava Idle; algumas séries estavam
indisponíveis. O rótulo de pooler “Max: 10000” é configuração/limite, não prova de
10 mil conexões observadas. A UI não forneceu aqui uma medida numérica confiável
do pico de conexões: não preencher com zero ou com o limite configurado.

## Leitura SQL agregada da produção

[Actions 40386694815](https://github.com/Faysk/world-pulse/actions/runs/40386694815),
19:26:16 UTC: PostgreSQL 18.6 e 8.519.680 bytes em pg_database_size (8,125 MiB).
Requests_day: 8.037 na janela iniciada à meia-noite UTC de 26/10. Reads_minute:
1 em janela 19:23 UTC, já antiga na coleta. Não transformar janela antiga em taxa
atual, não somar retries de forma a inventar usuários e não equiparar tamanho SQL
ao Storage Neon: as métricas incluem componentes diferentes.

## R2 e limites desta linha de base

Readback do backup e restauração real foram comprovados em
[40388219471](https://github.com/Faysk/world-pulse/actions/runs/40388219471).
O dashboard Cloudflare ficou no carregamento após tentativa e uma recarga.
Logo não há nova medição de operações/storage por bucket ou prova de lifecycle.
O total de uma conta compartilhada não deve ser atribuído a estes dois buckets.

Nenhuma fatura, preço unitário aplicado ou extrapolação financeira foi calculada.
A existência de folga nestas leituras pequenas não comprova carga representativa.
Backups, previews e builds também consomem recursos. As medições precisam repetir
as mesmas janelas/escopos após uso público para avaliar tendência e custo.

## Decisão operacional

Manter os provedores/plano atuais e os budgets conservadores enquanto coletamos
tráfego público. O ganho medido de #152 está em bytes, transações e retries;
o feed saudável ainda é 5 s. Não aumentar budgets ou anunciar capacidade de pessoas
com base nessa amostra. #147 continua com feed compartilhado/viewport/deltas e
carga interativa; #7 continua com consumo representativo, conexões e atribuição R2.
Custódia externa depende do passo do proprietário em [53](53-service-recovery.md).
