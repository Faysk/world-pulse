# 09 — Direção visual: Night Lights / Living Lights

**Data:** 23/10/2026  
**Status:** referência estética aprovada para **pesquisa e prova de conceito**, não implementação validada.  
**Issue principal:** [#10](https://github.com/Faysk/world-pulse/issues/10)  
**Relação:** [#1 — motores e nitidez](https://github.com/Faysk/world-pulse/issues/1), [#2 — manchas por participantes](https://github.com/Faysk/world-pulse/issues/2).

## Visão

O usuário gostou das **pequenas luzes noturnas** demonstradas em exemplos de MapLibre e propôs expandi-las conforme mais pessoas participam. A Terra deve ser cinza, em ambiente espacial escuro, e ganhar **manchas orgânicas de luz colorida** para hashtags.

A referência de expansão e densidade continua sendo [Population Heatmap](https://globe.gl/example/population-heatmap/) do Globe.gl, mas com visual aperfeiçoado e **zoom progressivo nítido** por tiles vetoriais e/ou dados geográficos mais detalhados.

## Três sistemas gráficos separados

1. **Superfície:** continentes e oceanos cinzentos, costas e detalhes nítidos à medida que aproxima. Não depender de uma textura global ampliada.
2. **Fundo noturno:** brilho de cidades/estradas **neutro, opcional e sutil**. Caso usado, nunca aparecer como participação real. Pode ser removido se poluir a visualização.
3. **Campo de luz das hashtags:** cores próprias persistidas, nascimento de pontos, influência por densidade de **pessoas**, conexão natural de campos próximos e dissipação conforme presença.

Essas luzes **não** devem sugerir que cliques fazem as manchas crescerem. **Um click/tap válido adiciona +1 segundo somente ao contador**. A área colorida é alimentada exclusivamente pela quantidade e distribuição de **participantes distintos**.

## Proposta de animação

- **Nascimento:** ponto de luz com pulso breve na célula geográfica aproximada.
- **Acúmulo:** o mesmo local ganha luminosidade, opacidade e concentração.
- **Expansão:** novas células vizinhas ocupadas criam campos sobrepostos; a mancha se conecta por proximidade, não por raio artificial baseado no número bruto.
- **Concorrência:** cada cor representa sua hashtag; lidar com várias próximas preservando leitura dos grupos.
- **Dissipação:** interpolação suave de contagem ou presença reduzida; política exata ainda pendente [#9](https://github.com/Faysk/world-pulse/issues/9).
- **Zoom:** à distância campos suaves; de perto granularidade maior sem expor residência. A base geográfica também ganha detalhes reais.

## Tecnologia candidata

- [MapLibre GL JS](https://maplibre.org/) para globo e tiles geográficos de vários níveis.
- Protótipo inicial com [heatmap nativo](https://maplibre.org/maplibre-gl-js/docs/examples/create-a-heatmap-layer-on-a-globe-with-terrain-elevation/) para **uma** hashtag ou pequeno conjunto.
- **Limitação a testar:** `heatmap-color` no MapLibre nativo não aceita cor arbitrária por feature, portanto muitas hashtags não podem ser simplesmente desenhadas como **um** heatmap com `color` por ponto. Soluções possíveis: camada por hashtag para poucos grupos (POC) ou shader próprio / texturas de campo agregadas para escalar.
- [Camada WebGL customizada no globo](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-simple-custom-layer-on-a-globe/) para mistura/composição de cores e bloom/halo sob controle.
- H3 por regiões aproximadas para volume de dados e LOD; computar influência espacial sem ampliar pixels.

## Referências concretas

**[Night Lights Globe — romainoir](https://github.com/romainoir/Maplibre-Globe)**

Projeto de referência em MIT usando MapLibre, dados de elevação, glow vetorial de estradas, heatmap de áreas urbanas e controle de dia/noite. Acompanhar a [demo](https://romainoir.github.io/Maplibre-Globe/) e estudar `scripts/nightLights.js` e `scripts/stylePreset.js`. Esse brilho noturno representa **infraestrutura urbana**, não pessoas usando hashtags; usar apenas como inspiração de linguagem visual.

**[The Earth as real as MapLibre can draw it](https://makewithmaplibre.com/globe/)**

Mostra globo com zoom de imagens/terreno, atmosfera e luzes noturnas baseadas no Black Marble da NASA, com transição astronômica. Excelente referência de acabamento e qualidade, mas **não** implica que o World Pulse precise de horário real ou textura de satélite colorida.

**[MapLibre layers specification](https://maplibre.org/maplibre-style-spec/layers/)**

Relevante para propriedades de heatmap, peso por densidade, raio no zoom, cor, opacidade e desempenho.

## Experimentos obrigatórios

1. Terra cinza sem iluminação, screenshot no globo + continente + cidade.
2. Terra cinza + iluminação urbana neutra de baixa opacidade.
3. Terra cinza + 3 hashtags coloridas por grupos geográficos.
4. Prova de 1/10/100 pessoas numa mesma célula — **somente brilho e intensidade**, sem esconder distribuição.
5. Prova de 100 pessoas dispersas — múltiplos focos com bordas e fusão visual.
6. Benchmark de 10, 100 e 1000 hashtags sintéticas para medir gargalos e experimentar render por shader.
7. Prova de que clique +1000 segundos numa mesma pessoa **não** altera a mancha.
8. Zoom com detalhes reais e sem borrão/pixelização de mapa nem de glow.
9. Perfil de performance: FPS, render buffer HiDPI, memória, tiles/seg e tempo de transição mobile.
10. Confirmar licenças e limites gratuitos dos dados de mapas e textura noturna.

## Questões abertas

- Fundo permanentemente noturno vs posição solar realista (testar sem assumir filtros).
- Desenhar luzes urbanas reais de fundo ou deixar todo brilho reservado às hashtags.
- Manter glow próximo do solo versus leve halo elevado, evitando a estética "árvore de Natal".
- Como compor cores concorrentes no mesmo pixel preservando categorias.
- Quando expirar presença geográfica, separado da persistência dos segundos.
- Limite de zoom geográfico por confiabilidade de IP e privacidade.

## Não fazer ainda

- Não escolher biblioteca apenas pelo screenshot.
- Não adicionar controle de relógio/dia-noite ou filtros sem teste e aprovação.
- Não implementar efeitos que transformem taps em intensidade.
- Não assumir que glow de cidades é visualização de participação real.
