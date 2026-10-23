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
