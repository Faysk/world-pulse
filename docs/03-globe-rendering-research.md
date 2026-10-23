# 03 — Pesquisa do motor gráfico e das manchas

**Status:** pesquisa, **sem escolha final**.

## Requisito principal

O globo inicia cinza e permite giro, zoom e inércia fluidos (desktop/mobile). Sobre o planeta há **campos de densidade multicoloridos por hashtag**, baseados em **quantidade de pessoas distintas por região**. A mancha é dinâmica e orgânica; o zoom revela detalhe progressivo, nunca posições residenciais.

## Candidatos open-source

| Motor | Hipótese / benefício | Risco que devemos testar |
|---|---|---|
| [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) | Mapa/globo, estilo monocromático, câmera, heatmaps e camadas customizadas | Heatmap multicolorido por milhares de hashtags, comportamento em zoom e custos dos tiles |
| [Globe.gl](https://globe.gl/) | Globo 3D orientado a efeitos e camadas de pontos/heatmap | Navegação estilo Google Earth ao aprofundar zoom; textura/tiles e performance |
| [CesiumJS](https://cesium.com/platform/cesiumjs/) | Cena geoespacial 3D madura, câmera/terreno | Complexidade, memória e assets/tiles na modalidade gratuita |
| [deck.gl](https://deck.gl/) | Heatmap e agregação acelerada por GPU | Compatibilidade com globo e coordenação das projeções |
| [H3](https://h3geo.org/) | Agregação espacial hexagonal para reduzir payload | Células visíveis e artefatos de borda se usadas sem suavização |

**Importante:** biblioteca open-source não garante tiles/terreno gratuitos. Avaliar [OpenFreeMap](https://openfreemap.org/) ou tiles hospedados sob termos adequados.

## Experimento POC A — câmera

- Comparar MapLibre × Globe.gl (e Cesium apenas se necessário).
- Rotação, inércia, cursor-centered zoom, pinch, dois dedos para inclinar, responsividade.
- Passar da visão global para país/cidade; sem pulo visual abrupto.
- Base neutra cinza, oceanos/continentes distintos, sem elementos externos.
- Medir FPS/memória, desktop e celular.

## Experimento POC B — densidade

- Dados sintéticos para 1 / 10 / 100 / 1.000 pessoas; depois 10k/100k/1M **pontos equivalentes** agregados.
- Uma pessoa em bairro amplo → brilho local sutil, não pintar cidade toda.
- Mil pessoas sobrepostas → **mais intensidade**, não um raio absurdo.
- Mil pessoas distribuídas → área mais ampla pela distribuição, não pelo número bruto.
- Hashtags com cores próprias em mesma região → competição legível.
- Borda suave; efeito de chegada discreto e dissipação visual; evitar flicker.
- Desacoplar renderização de refresh de dados (interpolação na GPU).

## Algoritmos candidatos

1. **Kernel de densidade (KDE)** espacial separado por hashtag + renderização via shader.
2. **Agregação H3** em múltiplas resoluções e suavização na GPU; densidade por célula + hashtag.
3. **Textura raster temporal** construída a partir de agregados, atualizada incrementalmente.
4. Camadas nativas de heatmap como baseline e benchmark.

Não presumir que um único heatmap multicolorido represente múltiplos grupos corretamente; comparar shader dedicado com camadas isoladas e composição por maior densidade.

## Critérios de aceite técnicos (metas, não garantias)

- Desktop: objetivo ~60 FPS; celular: ~30–60 FPS com degradação adaptativa.
- Dados atualizados periodicamente sem reinicializar mapa.
- Orientação, pan, zoom e seleção funcionando durante transição da mancha.
- Performance medida com cenários densos e dispersos, além de múltiplas hashtags.
- Registrar screenshots, profiling e decisão técnica em ADR após os testes.

## Referências iniciais

- [MapLibre: exemplo de heatmap no globo](https://maplibre.org/maplibre-gl-js/docs/examples/create-a-heatmap-layer-on-a-globe-with-terrain-elevation/)
- [Globe.gl — documentação e exemplos](https://globe.gl/)
- [H3 — documentação](https://h3geo.org/docs/)
- [deck.gl — documentação](https://deck.gl/docs)
- [CesiumJS](https://cesium.com/platform/cesiumjs/)
- [OpenFreeMap](https://openfreemap.org/)
