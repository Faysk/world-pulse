# Release visual — World Pulse v0.1 (Living Earth)

**Publicação:** 24/10/2026 · **Alvo:** produção Vercel · **Domínio:** [map.faysk.dev](https://map.faysk.dev)

## Identificadores verificáveis

- **GitHub PR:** [#14](https://github.com/Faysk/world-pulse/pull/14) — integrado a `main`.
- **Git commit de produção:** `84d50a59f82617847803c73f8a4354fd743f8fd4`.
- **Vercel deployment:** `dpl_3sSYkV5sUbtRxJaE8WRogNH1vnRQ`.
- **Vercel status:** **READY**, `target=production`.
- **Vercel aliases:** inclui `map.faysk.dev` e os domínios `vercel.app` do projeto.
- **Domínio:** `map.faysk.dev` estava **verified=true** no projeto antes do deploy.
- **Pipeline:** deploy explícito do commit `main` pela API autenticada da Vercel. O `git.deploymentEnabled.main=false` foi preservado; **não** foi executada a operação `check/sync/deploy` do workflow manual de infraestrutura nesta publicação, pois a infraestrutura já havia sido preparada pelo usuário.
- **Build:** Vercel Vite/TypeScript concluído; warnings de bundle grande do MapLibre, não erro.

A resolução de conflitos no PR incorporou a configuração da infraestrutura e a da aplicação no mesmo `vercel.json`, preservando o bloqueio de deploy automático em `main`.

## Funcionalidades publicadas

- Mapa-globo MapLibre com tiles de base vetorial via OpenFreeMap e estilo noturno cinza.
- Três hashtags de demonstração: `#GTA6`, `#Minecraft`, `#LoFi`, com participantes totalmente **simulados**.
- Luzes orgânicas coloridas e transição de heatmap para focos menores conforme zoom.
- Interface desktop; UI mobile com ranking/laboratório recolhidos.
- Simulador de pessoas para intensidade das manchas.
- Seleção de hashtag e contador local de **+1 segundo por toque elegível**, separado da densidade de pessoas.
- Botão alternativo +1 segundo para teste de acessibilidade.

## Avisos obrigatórios

**Esta versão é apenas uma POC visual**. Não existe integração frontend→Neon, contribuição durável, localização real de pessoas, nem ranking verdadeiro. Neon e R2 estão provisionados na infraestrutura, mas não são utilizados pelo frontend.

A atribuição de cor está fixa para os três dados simulados, e a seleção espacial usa células sintéticas aproximadas. A validação visual com tiles reais e medição de FPS em celular físico **não** foram aprovadas ainda; manter [issue #12](https://github.com/Faysk/world-pulse/issues/12) aberta.

**Verificação adicional:** A Vercel confirmou READY e a associação do domínio; uma requisição HTTP externa independente de `map.faysk.dev` não pôde ser concluída pelo ambiente de ferramentas usado para este release. Confirmar interativamente no navegador do usuário.

## Próxima etapa

- Verificar a página no Chrome e em celular físico.
- Avaliar nitidez desde a visão global até a cidade e desempenho dos heatmaps com muitas cores.
- Analisar o pipeline de `npm ci` da infraestrutura (#21): frontend ainda precisa de `package-lock.json` versionado para esse workflow.
- Definir #9 e começar os contratos reais de API nas etapas v0.2/v0.3, sem expor dados individuais.

## Atualização verificada — 24/10/2026

Este registro atualiza o estado da primeira publicação descrita acima:

- PR #23 integrado com lockfile, npm ci e correção das expressões de zoom do MapLibre (#24).
- Commit publicado: `128bd138b2cd44badd9fde29c9e53ce9d1bc0064`.
- Deployment Vercel: `dpl_41HLMXDouvPriGKZE8tRZHCN7nyZ`, READY.
- [Pipeline de produção](https://github.com/Faysk/world-pulse/actions/runs/40037961587): **success**, incluindo validação sem secrets, testes/build do app, consultas SQL/TLS, teste R2, sync de configuração e publicação.
- [CI desktop/mobile do PR #23](https://github.com/Faysk/world-pulse/actions/runs/40037661262): **success**, com captura de erros de console além de exceções.
- Requisição HTTPS externa: **HTTP 200**, título World Pulse — Living Earth POC.
- Chrome no domínio público: mapa real OpenFreeMap carregou, atribuições visíveis, seleção de hashtag e +1 local funcionaram; nenhum console.error observado nessa verificação.

Portanto, o lockfile e a verificação externa deixaram de ser pendências, e o release corrigido foi publicado **pelo GitHub Actions**. A publicação inicial anterior permanece acima como histórico. Continuam pendentes benchmark em celular físico, nitidez em vários níveis de zoom e integração real frontend/API/banco; manter #12 aberta. Não interpretar a publicação da POC como aceite dessas funcionalidades.


## Atualização de desempenho — 24/10/2026 (PR #26)

A identidade visual foi preservada; alterações internas para evitar trabalho desnecessário enquanto o usuário navega:

- Mouse hover sobre focos luminosos agora usa `requestAnimationFrame` para coalescer eventos, evitando múltiplas consultas por frame.
- Enquanto a câmera move, hit-testing de hover é suspenso (o clique para seleção permanece).
- Alterações rápidas no slider de população atualizam o GeoJSON com coalescência por frame e cancelamento da versão anterior.
- A animação sintética para com a aba oculta e retoma ao voltar, mantendo a mesma intensidade.
- Teste Playwright de ciclo de vida de aba incluído em Chromium, além dos testes existentes.
- **PR #26:** https://github.com/Faysk/world-pulse/pull/26 (integrado)
- **Commit integrado:** `77cbd8327183471ec06f221c8c55cd6b70cb5adc`.
- **CI:** https://github.com/Faysk/world-pulse/actions/runs/40038149682 — `build` e `browser-smoke` concluídos com `success`.
- **Deployment production:** `dpl_6HbeWdvf1ZXCFm81BVaHrkgFF5FQ`, Vercel `READY`, alias confirmado `map.faysk.dev`.

**Não foi feito benchmark quantitativo de FPS nem prova de desempenho em celular físico**. A aprovação do usuário sobre a estética não substitui medições técnicas em vários dispositivos. Ainda sem participação real ou backend conectado.
