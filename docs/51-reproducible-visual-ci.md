# 51 — Preparação reproduzível dos testes visuais

26/10/2026 · #149 · milestone v0.4.

O job `preview-build-gate` foi cancelado durante instalação de dependências do
Playwright, antes de executar testes. No [40354147209](https://github.com/Faysk/world-pulse/actions/runs/40354147209)
o log mostra downloads de fontes/pacotes no mirror Ubuntu da Azure consumindo
minutos; a preparação de outro run repetiu o sintoma em
[40369116459](https://github.com/Faysk/world-pulse/actions/runs/40369116459).
Isso é diferente do cenário mobile com um único timeout, rastreado em #97.

Os jobs visuais `preview-build-gate` e `browser-smoke` passam a usar a imagem
oficial `mcr.microsoft.com/playwright:v1.64.0-noble`, fixada pelo digest
`sha256:06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f`.
O registry respondeu 200 para essa versão e digest em 26/10. Browsers e bibliotecas
já estão na imagem; o pacote Node continua instalado pelo lockfile com npm ci.

`verify-playwright-runtime.mjs` exige versão instalada igual ao package.json e
à imagem declarada, confere o binário incluído, inicia Chromium e verifica WebGL2
com os mesmos argumentos de SwiftShader dos testes. Atualizar Playwright exige
atualizar também a imagem/digest; não substituir por latest. A memória compartilhada
do container tem 1 GiB; não são usados modo privilegiado, SYS_ADMIN ou IPC do host.

São mantidos os mesmos builds, testes desktop/mobile, argumentos de software GL,
artefatos e limites de tempo. Só PRs superados são cancelados automaticamente;
execuções main e publicações não entram nesse cancelamento. O job build sem
browser continua no runner normal. O job de integração com PostgreSQL em
`participation-api-ci.yml` permanece no host, preservando o loopback fixado;
esta mudança não altera sua topologia nem conecta testes ao banco real.

O container serve apenas a testes do projeto, sem Environment/secrets de produção.
Não é navegador para dados pessoais ou sites externos não confiáveis e não é
runtime de produção. A decisão de validar aparelhos reais com o público continua
vigente; Chromium/SwiftShader em container não comprovam GPU ou FPS de celulares.

Fonte: [documentação oficial de Docker do Playwright](https://playwright.dev/docs/docker).
Os recibos e tempos observados serão registrados após a execução equivalente.
