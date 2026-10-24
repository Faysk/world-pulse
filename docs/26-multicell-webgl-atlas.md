# 26 — Atlas WebGL2 instanciado: múltiplas células num único draw (#32)

**Estado:** spike isolado. Novo `src/overlapAtlas.ts` e laboratório `experiments/overlap-atlas.html` (apenas Vite DEV). **Não integrado ao globo público** nem a dados reais.

## Por que existe

O [primeiro compositor](25-overlap-compositor-spike.md) desenhava as cores de até 12 hashtags num único draw **por célula**, mas renderizar centenas de células dessa maneira geraria centenas de draw calls. Este corte empacota **até 256 células amplas** num atlas GPU, desenhando o conjunto com **um único `gl.drawArraysInstanced`**.

Não há um shader por hashtag. Cada célula referencia cores originais, quantidades de participantes agregadas e cortes angulares; a composição é determinística e independe da ordem de entrada.

## Layout do atlas

A entrada é uma lista de células agregadas amplas e já sujeitas à política de privacidade. O preparo:

1. Ordena células por `cellKey`, recusando chaves duplicadas.
2. Reaproveita `buildCellPalette()` para cada célula, preservando o total de participantes e cada hashtag.
3. Empacota até 12 cores por célula em **12 texels RGBA8** (`RGB` cor; `A` corte angular normalizado); o 13º texel armazena brilho, rotação e número de setores. Total: **52 bytes brutos por célula** (256 células = 13.312 bytes), sem contar overhead de WebGL/JS.
4. Shader Vertex usa `gl_InstanceID` para dispor cada célula num grid; fragment Shader usa `texelFetch`, calcula setor e alpha local.
5. Uma chamada GPU instanciada desenha todas as células; preparar/upload ainda exige CPU, largura de banda, contexto e memória GPU. O benchmark desta etapa não comprova FPS.
6. A seleção CPU `pickAtlasSector()` interpreta os **cortes angulares quantizados da mesma textura** para preservar o setor do clique. Ignora slots vazios e cliques fora dos discos.
7. `AtlasRenderer.dispose()` libera explicitamente programa, textura, buffer e vertex array, para não vazar recursos ao experimentar muitos cenários.

O teto de 256 células e de 12 hashtags/célula falha explicitamente se excedido — **sem apagar silenciosamente participantes**, mas também sem resolver ainda viewport/paginação.

### Quantização e limitações visuais

- `RGBA8` armazena limites angulares em passos aproximados de 1/255. As contagens originais permanecem inteiras no objeto JS, mas o arco não é um gráfico de proporção exata.
- A rotação é quantizada no upload. A seleção de setor usa as mesmas quantizações.
- O piso visual de 3,5% da primeira pesquisa aumenta setores muito pequenos para torná-los selecionáveis. A legenda precisa informar **participantes exatos**; não interpretar fração do arco como porcentagem.
- Células amplas reduzem risco de exposição de pontos precisos, mas **não provam anonimato**, e a política de supressão da issue #6 ainda precisa ser aplicada **antes** de construir o atlas.
- Números do cenário de 1 trilhão são sintéticos; não é prova de backend suportar usuários reais.

## Testes

```sh
npm ci
npm run check
npm run dev
# http://localhost:5173/experiments/overlap-atlas.html
```

A suíte `tests/overlapAtlas.test.mjs` cobre 125 células, determinismo por ordem das células e hashtags, clique na hashtag minoritária, slots vazios, orçamento de 256 células, overflow, cenário agregado com 1 trilhão sintético e inexistência de dependência de clicks/segundos.

`tests/browser/overlapAtlas.spec.ts` abre o laboratório com WebGL2 real (SwiftShader no CI), verifica que 4/64/256 regiões desenham com apenas **uma chamada instanciada por cenário**, lê cor RGBA do framebuffer, valida clique no setor, número exato e captura desktop/mobile.

## Ainda pendente para aceite da issue #32

- [ ] Substituir o grid de laboratório por posicionamento geográfico real na projeção do globo (antimeridiano, latitude alta, zoom/pan).
- [ ] Implementar **viewport paging e atlas em blocos** quando existirem mais de 256 células, sem saltos visuais ao mudar zoom.
- [ ] Comparar estética das manchas orgânicas reais (bordas difusas, raios variáveis, transição ao zoom), incluindo países grandes e regiões densas.
- [ ] Confirmar clipping, alfa e ordem de render do layer custom MapLibre sem cobrir rótulos de mapas nem criar WebGL context adicional por mapa.
- [ ] Medir p50/p95 de upload e frames reais com tiles/mapa em GPU de smartphone e desktop físicos.
- [ ] Estratégia para mais de 12 hashtags numa mesma célula, garantindo acesso/seleção a todas sem explosão de shaders.
- [ ] Conectar somente agregados do backend sujeitos a política de privacidade e retenção aprovadas (#6).

Este módulo é **uma prova técnica no repositório**; não substitui o visual de produção.
