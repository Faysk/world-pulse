# 25 — Composição multicolorida por célula (issue #32)

**Estado:** experimento Vite DEV-only, não ligado ao globo MapLibre, nenhuma mudança no público `map.faysk.dev`.

## Problema resolvido no experimento

A POC usa um heatmap por hashtag. Quando 2–3 camadas têm atividades coincidentes, a cor desenhada por último pode apagar as anteriores. A solução experimental usa **um único WebGL2 draw call por célula de exibição**, com setores angulares adjacentes e matizes preservados; nenhuma média RGB ou sobreposição de passes.

A entrada é um agregado por célula **geográfica ampla, previamente sujeito à política de privacidade**, com participantes distintos por hashtag. Não admite coordenada individual, IP, GPS, taps ou segundos.

## Implementação

- `src/overlapCompositor.ts` prepara paleta determinística independentemente da ordem original das tags.
- A ordenação dos setores é pelo identificador de hashtag; o ângulo inicial varia de forma reprodutível apenas pela chave da célula regional.
- Em cada pixel o shader WebGL2 calcula radialmente brilho/alpha e atribui o matiz **de uma hashtag**, sem mistura RGB.
- A seleção reutiliza um sampler CPU de referência compatível com a fórmula angular da GPU. O laboratório permite clicar numa cor e ver a hashtag correspondente, sem creditar segundos.
- O peso angular recebe um piso visual de 3,5% por hashtag. Isso garante legibilidade para uma hashtag com 1 participante contra outra com 999, mas **torna as áreas setoriais não proporcionais exatamente aos participantes**. A interface informa a contagem exata em legenda.
- A intensidade geral vem exclusivamente do total de participantes distintos agregado, com escala logarítmica ilustrativa. Cliques e segundos não entram na fórmula.
- Suporta até 12 hashtags coincidentes por célula; acima disso rejeita explicitamente em vez de ocultar dados ou cores. Não afirmar suporte arbitrário ao Top 10 global por região antes de desenvolver paginação/agrupamento.
- Uma célula vazia torna-se totalmente transparente.

## Abrir e avaliar localmente

```bash
npm ci
npm run dev
# http://localhost:5173/experiments/overlap-lab.html
```

O arquivo `experiments/overlap-lab.html` **não pertence ao bundle de produção** gerado pelo Vite: serve apenas como laboratório visual sob o dev server. Contém cenários sintéticos (3 hashtags, 999 vs 1, 1 trilhão e vazio). Nenhum dado é persistido. As cores da demo não são a lógica de sorteio persistente da API real.

## Verificação técnica

- `tests/overlapCompositor.test.mjs`: ordem inversa, determinismo, população exata, matizes preservados, zero, contagem de 1 trilhão sintético após agregação e erro explícito ao extrapolar a capacidade.
- `tests/browser/overlapCompositor.spec.ts`: compilação e renderização WebGL2 efetivas, leitura dos canais RGBA do framebuffer, seleção de hashtag minoritária e screenshots Chromium desktop/mobile.
- Tempo exibido no laboratório é apenas **CPU+draw** naquela máquina; não é FPS, p95 GPU, benchmark de VRAM, rede ou escala de usuários reais. Medições em hardware físico ainda pendentes.

## Limitações antes de integrar no MapLibre

1. Experimento de um passe por **célula**, não ainda um único passe para todo o globo. A integração deverá gerenciar instâncias/atlas de células numa camada custom MapLibre, cap de draw calls e event handling.
2. Forma setorial é referência técnica, não decisão estética. Testar alternativas de bordas luminosas / ring patterns, suavidade e percepção de movimento.
3. Não fornece polígonos país, zonas de privacidade ou supressão mínima; #6 ainda bloqueia localização real.
4. Não resolve quem vence um toque no limite exato de duas células nem interação entre clusters separados.
5. Suporte WebGL2 não garantido em todo dispositivo. Necessário fallback sem travar o mapa.
6. Com 12+ hashtags por mesma célula, planejar visualização multigrupo que nunca apague identidades, possivelmente detalhe adicional sob interação.
7. Nenhum FPS real, memory profiling, cache por viewport e cenário 0–1 trilhão em GPU móvel física foi ainda medido.

**Status issue #32:** primeiro shader funcional isolado; composição aprovada no renderer real, fluidez mobile e geometria privada ainda em aberto.

## Evidência de CI (24/10/2026)

A [GitHub Action #40052205797](https://github.com/Faysk/world-pulse/actions/runs/40052205797) concluiu com **success**: `npm run check`, compilação WebGL2 e leitura dos pixels no Chromium desktop e emulado mobile. Capturas dos cenários ficaram no artefato [world-pulse-overlap-webgl-spike](https://github.com/Faysk/world-pulse/actions/runs/40052205797). O código e os testes validam preservação das cores, não aprovação visual final em aparelho físico.
