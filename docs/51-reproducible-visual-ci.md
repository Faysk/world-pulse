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

O teste de gesto mobile recolhe o laboratório após a preparação e direciona o
toque nativo ao canvas com verificação de actionability. Um painel aberto pode
interceptar a coordenada fixa usada anteriormente; isso não deve ser confundido
com falha do reconhecedor. Continuam exigidos exatamente um crédito no tap,
nenhum crédito por navegação e os mesmos limites de duração/movimento do produto.

Fonte: [documentação oficial de Docker do Playwright](https://playwright.dev/docs/docker).

## Validação e recibos

A suíte completa passou no [run 40375877502](https://github.com/Faysk/world-pulse/actions/runs/40375877502),
head `92a617e`, integrado pela [PR #150](https://github.com/Faysk/world-pulse/pull/150).

| Job | Resultado | Duração total |
| --- | --- | --- |
| build | aprovado | 15 s |
| preview-build-gate | aprovado | 1 min 03 s |
| browser-smoke Chromium | aprovado | 4 min 51 s |
| browser-smoke mobile Chromium | aprovado | 7 min 41 s |

O preflight de versão/binário/WebGL2 levou cerca de 1 s em cada job com browser.
A inicialização dos containers levou 27–40 s; esse custo continua existindo,
mas a execução não dependeu de downloads apt do mirror que interrompia o gate.
Os tempos são observações desta execução, não garantias de duração futura.

O teste direcionado de gesto também passou localmente nos dois projetos antes
da suíte completa. Nenhum limite ou reconhecedor de gesto do produto foi alterado.
Os jobs de API/PostgreSQL e staging continuam fora desta mudança. A cobertura
emulada não substitui a observação gradual de aparelhos reais com o público.
