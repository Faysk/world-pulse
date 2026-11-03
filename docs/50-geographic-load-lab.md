# 50 — Laboratório de carga geográfica (isolado)

## Objetivo

Modelar 1.000, 10.000, 100.000 e 1 bilhão de utilizadores e liberação global vs. meia-noite local, sem produzir carga externa. Separar demanda teórica, benchmark CPU/visual, HTTP local e capacidade observada.

## Segurança e escopo

- Não fazer load test contra map.faysk.dev, Vercel Hobby/previews, Neon remoto, OpenFreeMap ou qualquer terceiro. A Vercel exige autorização específica e restringe load testing à Enterprise: https://vercel.com/kb/guide/what-s-vercel-s-policy-regarding-load-testing-deployments
- Não usar botnets, proxies, spoofing de IP, sessões falsas em produção, nem contornar limites.
- Usar HTTP loopback e PostgreSQL local descartável, sem segredos de cloud.
- Modelar 1 bilhão de pessoas não cria 1 bilhão de processos, conexões ou pedidos reais.

## 1. Modelagem offline

Node 22 ou superior, sem dependências adicionais:

    node scripts/geo-load-model.mjs --population=1000
    node scripts/geo-load-model.mjs --population=10000 --release=rolling
    node scripts/geo-load-model.mjs --population=100000 --active-bps=2500
    node scripts/geo-load-model.mjs --population=1000000000 --release=simultaneous
    node --test tests/geo-load-model.test.mjs

Argumentos:
- population: de zero até 1 trilhão, contadores exatos BigInt em strings JSON.
- active-bps: fração ativa em unidades por 10.000; padrão 1.000 = 10%.
- requests-per-active: pedidos teóricos por utilizador ativo; padrão 2.
- duration-seconds: janela por região, padrão 3.600 segundos.
- release: simultaneous (todos 00:00 UTC) ou rolling (meia-noite local aproximada).

A distribuição de oito regiões e seus pesos são inteiramente sintéticos, NÃO são censo, distribuição real de jogadores ou dados reais de geolocalização. Os fusos são fixos e ignoram horário de verão. singleWindowDemandRps é demanda de todas as regiões concentrada numa janela; peakModeledRps é a maior onda regional. São números hipotéticos, não medições.

Exemplo: 1 bilhão, 10% ativos, 2 pedidos em uma hora = 200 milhões de pedidos teóricos. Se todos começassem juntos, aproximadamente 55.556 pedidos/s. Isso não comprova que a aplicação os aguenta.

## 2. Benchmark HTTP já existente

O projeto já possui scripts/snapshot-capacity.mjs, que utiliza servidor local 127.0.0.1:4180 e Postgres local descartável em 127.0.0.1:5432/world_pulse_capacity, exige banco vazio, migra schema, cria dados sintéticos, faz GETs de 1–100 abas e mede p50/p95/p99, SQL, orçamento e fila de pool. Revisar preparação e ambiente antes de executar.

## 3. k6 opcional — somente loopback

loadtests/local-readonly.k6.js é GET-only, restringe alvo a http://127.0.0.1 ou http://localhost, taxa de 1–20 iterações/s, 1–50 VUs e duração de 5–120 segundos. Não segue redirecionamentos. Com API local isolada **já em execução** e banco local descartável:

    k6 run -e WP_LOCAL_ORIGIN=http://127.0.0.1:4180 -e WP_RPS=2 -e WP_SECONDS=30 loadtests/local-readonly.k6.js

IMPORTANTE: snapshot-capacity.mjs encerra seu próprio servidor ao terminar; não é servidor persistente para k6. Para o probe, preparar uma fixture separada no loopback, nunca uma configuração que conecte a banco remoto ou produção. O tag geo_profile nas métricas apenas segmenta perfis sintéticos; não reproduz IP ou latência física de países diferentes.

## 4. Observabilidade e paragem

Registrar SHA, origem, fixture, tráfego desejado e entregue, p50/p95/p99, 429/5xx, dropped iterations, CPU, RAM, conexões e locks Postgres, filas, tempo de recuperação e custo. Abortar o ensaio ao detectar degradação acentuada ou uso próximo de quotas. O threshold p95 de 1.500 ms é provisório, não SLO de produção.

docs/25-api-operation-budgets.md documenta limites iniciais de 3.000 pedidos/min, 50.000/dia e 600 leituras/min. Conferir server/costPolicy.mjs para estado atual. Esses limites são quotas da aplicação, não defesa DDoS nem promessa de capacidade.

## 5. Roadmap

1. Exportar comparativos JSON/CSV de latência, erros e throughput.
2. Modelar 1k/10k/100k sessões lógicas e lotes em Postgres local descartável.
3. Testar navegador e FPS via Playwright/MapLibre com tiles locais, sem tocar fornecedores.
4. Simular 1 bilhão de eventos por agregados, partições e filas; medir tempo de processamento em infraestrutura própria.
5. Caso seja necessário testar milhares de origens geográficas reais, obter autorização do provedor, infra dedicada e orçamento explícito antes de iniciar.

Este laboratório não altera endpoints públicos, dados de produção, quotas, deployments nem workflows.