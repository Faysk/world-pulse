# World Pulse 🌍

> **Um planeta cinza que ganha cores com a participação das pessoas.**

**Status:** descoberta / pesquisa técnica · **Nome:** provisório · **Documentação inicial:** 23/10/2026

**Regra de tempo confirmada em 24/10/2026:** taps adicionam saldo por hashtag; esse saldo diminui em tempo real, inclusive offline. Várias hashtags podem manter manchas simultaneamente até seus saldos zerarem, mas novos taps aumentam apenas a hashtag selecionada. Histórico creditado e saldo restante são distintos. [Contrato completo](docs/14-time-credit-contract.md).

O visitante abre o site e já vê um **globo 3D navegável**, com giro, zoom e transições fluidas. A Terra é inicialmente cinza. Cada hashtag recebe uma **cor aleatória persistida** na primeira criação; manchas daquela cor surgem e crescem conforme **mais participantes distintos** escolhem esse # em suas regiões.

A interação é simples: selecionar ou criar uma hashtag e contribuir. **Cada clique/tap elegível soma +1 segundo** ao acumulado do participante **na hashtag ativa**. É possível trocar de hashtag sem perder o tempo acumulado anteriormente; **nunca contribuir para duas simultaneamente**.

> **Regra principal:** as **manchas dependem da quantidade de pessoas distintas e sua distribuição geográfica**, **nunca dos cliques ou segundos acumulados**. O tempo é outra métrica.

## Decisões confirmadas

- Entrada diretamente no globo cinza, sem cadastro obrigatório.
- Giro, zoom e exploração fluida, inclusive no celular.
- Cada hashtag nova recebe cor aleatória; a cor é fixa depois.
- Qualquer hashtag válida pode participar; tocar/clicar em uma hashtag ou cor existente permite selecioná-la.
- Cada clique/tap elegível credita +1 segundo, **não 1 segundo de duração real**.
- Apenas uma hashtag ativa por participante; tempos persistidos separadamente por hashtag.
- Manchas: intensidade e extensão guiadas por participantes distintos e localização, não por taps.
- Localização automática e aproximada; nunca posição residencial/individual precisa.
- Top 10 global e origem geográfica das hashtags; sem filtros na etapa inicial.
- Pilha desejada: **Vercel + Cloudflare DNS/R2 + Supabase**, buscando ficar dentro do gratuito.
- Sem monetização planejada. Antiabuso sofisticado e filtros não são prioridade antes da validação.
- Primeiro pesquisar/renderizar um protótipo gráfico com dados simulados; **nenhum motor está aprovado**.

## Documentação

- [01 — Visão e escopo](docs/01-vision-and-scope.md)
- [02 — Regras de interação e contagem](docs/02-interaction-rules.md)
- [03 — Pesquisa de motor gráfico](docs/03-globe-rendering-research.md)
- [04 — Geolocalização e privacidade](docs/04-geolocation-privacy.md)
- [05 — Arquitetura e Free Tier](docs/05-free-tier-architecture.md)
- [06 — Modelo de dados proposto](docs/06-data-model.md)
- [07 — Roadmap e critérios de aceite](docs/07-roadmap.md)
- [08 — Pontos em aberto](docs/08-open-questions.md)
- [09 — Direção visual Night Lights](docs/09-night-lights-visual-direction.md)
- [10 — Milestones e progresso planejado](docs/10-milestones-and-progress.md)
- [11 — Infraestrutura, secrets e GitHub Actions](docs/11-infrastructure-operations.md)
- [12 — Revisão crítica e próxima entrega](docs/12-project-review.md)
- [14 — Saldo de tempo e duração das manchas](docs/14-time-credit-contract.md)
- [13 — Release visual v0.1](docs/13-visual-release-v0.1.md)

## Planejamento por versões

| Release | Objetivo | Issues |
|---|---|---|
| **v0.1 — Living Earth** | Globo cinza, luzes orgânicas e preview visual | #1, #2, #10, #11, #12 |
| **v0.2 — Hashtags & Taps** | Seleção de #, cores e +1 segundo | #3, #4 |
| **v0.3 — Data & Presence** | Banco, presença e localização aproximada | #5, #6, #7, #9 |
| **v0.4 — Alpha** | Top 10 e integração ponta a ponta | #8, #13 |

📍 [Ver organização, critérios de aceite e progresso](docs/10-milestones-and-progress.md) · [Todas as issues](https://github.com/Faysk/world-pulse/issues) · [GitHub Milestones](https://github.com/Faysk/world-pulse/milestones)

**✅ Milestones nativos criados e 13 issues vinculadas.** Veja o [painel automático de progresso](https://github.com/Faysk/world-pulse/milestones). A configuração está documentada e automatizada pelo [GitHub Actions](.github/workflows/setup-milestones.yml).

## Próximo passo

**Prova de conceito do globo**: base cinza, navegação fluida, campos de densidade multicoloridos em múltiplos níveis de zoom e dados *simulados identificados como teste*. Só depois plugar localização, persistência e contagem real.

### Estado atual

**A POC visual v0.1 está publicada em [map.faysk.dev](https://map.faysk.dev)** (Vercel production READY, commit `84d50a5`, PR #14 integrado). Inclui globo MapLibre, luzes de hashtags simuladas e teste de +1 segundo apenas local; **não** há usuários reais, backend da aplicação ou geolocalização integrada. A infraestrutura Neon Free e R2 foi preservada. [Detalhes e limitações da publicação](docs/13-visual-release-v0.1.md).

Licença: [MIT](LICENSE).
