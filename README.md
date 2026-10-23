# World Pulse 🌍

> **Um planeta cinza que ganha cores com a participação das pessoas.**

**Status:** descoberta / pesquisa técnica · **Nome:** provisório · **Documentação inicial:** 23/10/2026

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

## Próximo passo

**Prova de conceito do globo**: base cinza, navegação fluida, campos de densidade multicoloridos em múltiplos níveis de zoom e dados *simulados identificados como teste*. Só depois plugar localização, persistência e contagem real.

### Estado atual

Repositório de planejamento. Não há app, deployment, banco ou algoritmo validado. Documentos distinguem explicitamente **decisão**, **proposta** e **experimento**.

Licença: [MIT](LICENSE).
