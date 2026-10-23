# 01 — Visão do produto e escopo

**Status:** visão acordada, detalhamento em pesquisa · 23/10/2026

## A ideia em uma frase

Um globo cinza, fluido e interativo, ganha manchas de cores sorteadas por hashtag: **a quantidade de pessoas participantes em cada região colore o planeta; cliques acumulam segundos separadamente.**

## Experiência principal

1. A página abre direto no **globo cinza**, sem tela inicial ou cadastro obrigatório.
2. O visitante gira, aproxima ou afasta a Terra livremente, com mouse ou toque.
3. A pessoa digita uma hashtag **ou seleciona uma já existente** tocando na cor/hashtag exibida.
4. A cor da hashtag já existe ou é sorteada e persistida na primeira criação.
5. Sua participação passa a contar para a mancha **da região aproximada**, sem revelar casa/endereço.
6. Cada **clique/tap elegível** credita **+1 segundo** para a hashtag selecionada.
7. Trocar de hashtag mantém os segundos históricos da anterior e impede contribuição simultânea.
8. Qualquer # pode entrar em contagem e ranking, independentemente do número de participantes.
9. Top 10 mostra popularidade e origem geográfica agregada. **Sem filtros no MVP.**

## A experiência NÃO é

- Uma ferramenta para provar que alguém está jogando/realizando algo.
- Uma rede social com feed, DM, perfis e seguidores.
- Um mapa de localização exata de pessoas.
- Um jogo em que spam de cliques aumenta manchas.
- Um produto comercial planejado neste estágio.

## Dois eixos separados

| Métrica | Origem | Efeito |
|---|---|---|
| **Pessoas distintas** | Seleção/participação por região | Força, densidade e dispersão da cor |
| **Segundos acumulados** | +1 por clique/tap elegível | Contador histórico da hashtag e do participante |

**Exemplo:** 1 pessoa com 50.000 s continua representando 1 pessoa no mapa. 100 pessoas com 1 s cada representam 100 pessoas na área.

## Princípios de UX

- O planeta é o conteúdo central; controles discretos em overlay.
- Mundo sem participações é **cinza real**, sem atividade fictícia para inflar números.
- Gestos de navegação devem permanecer fluidos, semelhantes ao Google Earth como referência de experiência (não uso de conteúdo proprietário).
- Manchas suaves e orgânicas, com contraste e acessibilidade, não polígonos abruptos.
- O usuário consegue identificar a hashtag/cor e seus contadores; o mapa nunca expõe dados pessoais individuais.
- Desktop e dispositivos móveis são requisitos desde a prova de conceito.

## Escopo do primeiro experimento

- Provar navegação 3D, zoom, câmera e camada de manchas simultaneamente.
- Simular pequenas e grandes distribuições de participantes e várias hashtags.
- Medir FPS, tempo de carregamento, memória e custo de draw calls; documentar resultados.
- Testar conflitos clique/tap versus arrastar/pinçar e seleção de cor existente.
- Dados de demonstração devem ser claramente marcados como **simulados**.

## Fora do escopo por enquanto

- Filtros por período, game, país etc.; antiabuso sofisticado; monetização; gamificação; login obrigatório; sincronização entre dispositivos; perfis; moderação complexa; milhões de usuários reais.
