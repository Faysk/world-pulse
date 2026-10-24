# 27 — Atlas geográfico por viewport (issue #32)

**Status:** laboratório Web Mercator 2D em `experiments/geographic-atlas.html` e módulo `src/geographicAtlas.ts`, **sem integração ao globo MapLibre e sem deploy público**.

## Objetivo

O [atlas anterior](26-multicell-webgl-atlas.md) desenha até 256 células regionais em um draw GPU, mas as apresenta como uma grade sem significado geográfico. Este corte faz uma ponte técnica entre centros regionais já agregados e pixels numa projeção cartográfica definida, além de permitir **mais de 256 células visíveis** dividindo-as em páginas GPU de até 256.

Não usa posições de pessoas, GPS, IPs, dados de sessão ou shapefiles individuais. Os dados de teste são completamente **sintéticos**. O fato de uma célula ser regional **não** equivale a autorização de publicar agregados: a política geográfica #6 continua obrigatória para dados reais.

## Projeção e viewport

- Web Mercator com tamanho mundial de `512 × 2^zoom` pixels. A câmera é longitude/latitude, zoom, largura/altura e nível espacial `cellZoom`.
- Latitude limitada internamente a ±85,05112878°, domínio da projeção Web Mercator. Coordenadas ilegais, zoom inválido e duplicação de chaves causam erro explícito.
- Diferenças de longitude normalizadas em `[-180°, +180°)`, escolhendo a cópia mais próxima; uma célula em `-179,4°` aparece perto de uma em `+179,5°` ao centralizar em `179,4°`.
- Radius de demonstração deriva do tamanho de tile projetado, com limite em pixels para evitar explosão. **Não é raio real de cidade nem área proporcional a participantes**.
- Recorte de células pela viewport com margem do raio. `totalPeople` (global da amostra) **nunca diminui ao dar zoom**; `visiblePeople` soma somente células desenhadas. Estes são totais sintéticos, não dados públicos.
- A ordenação por `cellKey` é determinística; cada página contém até **256 células** e usa um `gl.drawArraysInstanced`. Portanto, `620` células geram **3 draw calls**, não 620.
- A seleção do setor compara a coordenada do cursor com os círculos projetados e reutiliza os mesmos cortes angulares **quantizados para RGBA8** do shader. Overlaps seguem ordem de pintura reversa na seleção; ainda faltam políticas de colisão visuais.
- O programa WebGL2, VAO, buffers, instâncias e textura pertencem a um único contexto por laboratório e são reutilizados no zoom/pan; `dispose()` libera esses recursos.
- **Não existe paginação remota** nesta fase: todos os agregados já estão carregados na memória, sujeitos a limite explícito de 20.000 células. Futuro backend precisa servir tiles e batches por viewport.

## Experiência DEV-only

```sh
npm ci
npm run check
npm run dev
# http://localhost:5173/experiments/geographic-atlas.html
```

Câmeras: visão mundial, zoom Porto, meridiano ±180° e 620 células sintéticas. Zoom ajustável, graticule com linhas calculadas pela mesma projeção, métricas globais e visíveis separadas, contagem de páginas/draw calls e seleção de uma hashtag no disco. O laboratório não faz requests de API nem credita segundos.

## Testes automatizados e aceitação do corte

- Unitários `tests/geographicAtlas.test.mjs`: antimeridiano, centro da câmera, limites polares, invariantes de contagem global, culling, 600 regiões paginadas, amostras de 1 trilhão sintético, seleção de setor minoritário, determinismo após inverter entrada, contagens independentes de taps/segundos e validação de entradas.
- Playwright `tests/browser/geographicAtlas.spec.ts`: contexto WebGL2 real no Chromium em desktop e mobile emulado; 620 células em 3 draw calls; zoom preserva o total global; duas posições separadas pelo antimeridiano permanecem próximas; seleção da hashtag no setor de uma região local sem alterar contagens; screenshots.
- WebGL em GitHub Actions utiliza **SwiftShader**, não GPU móvel real. Mesmo 1–3 draw calls não prova desempenho ou memória em celulares físicos.

## Limitações e próximos passos reais

1. O globo do MapLibre usa projeção e transformações de câmera diferentes do canvas Web Mercator 2D. **Não** é integração esférica, não trata o lado oculto do globo, relevo, rotação ou sobreposição com labels.
2. Um atlas por viewport pode conter células sobrepostas; há necessidade de composição visual/ordenação e hit testing equivalente à renderização real, com zoom/pan contínuos.
3. Não há políticas de privacidade, supressão e caching de agregados reais; a issue #6 e o staging #53 permanecem bloqueios.
4. O orçamento de 20.000 células de origem é só um guard de memória, não política de transporte para produção.
5. Acima de 12 hashtags na mesma célula o compositor recusa o input; o produto precisa permitir acesso sem omissão das demais.
6. A forma setorial é um teste de preservação de matizes, não um design final. Para o World Pulse real, explorar manchas orgânicas, contornos e brilho mantendo as cores individuais.
7. Medir FPS p50/p95, WebGL buffer size e perda de contexto em hardware real antes de qualquer ativação.

**Issue #32 permanece aberta.** Este PR entrega a primeira projeção 2D e batching real em viewport, não o substituto do globo público.
