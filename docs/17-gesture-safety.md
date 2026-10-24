# 17 — Segurança de gestos no globo (issue #3)

A experiência World Pulse compartilha a mesma superfície WebGL entre navegação da Terra e seleção/contribuição. Não basta confiar que um evento `click` sempre signifique um toque intencional.

## Contrato implementado

O módulo `src/tapGesture.ts` é um reconhecedor determinístico (sem dados pessoais), consumido pelo MapLibre em `src/WorldGlobe.tsx`:

| Evento | Critério | Resultado |
| --- | --- | --- |
| Clique curto, imóvel, com hashtag selecionada | Pointer down/up, até 750 ms, deslocamento até 9 px (mouse) ou 16 px (touch) | O clique nativo MapLibre correspondente credita +1 segundo na seleção |
| Toque sobre hotspot de outra hashtag | Mesmos critérios | Seleciona a nova hashtag; **esse primeiro toque não credita** |
| Toque sobre hotspot da hashtag já selecionada | Mesmos critérios | +1 segundo na hashtag selecionada |
| Arrastar a Terra | Deslocamento acima da tolerância ou `movestart` | 0 segundos |
| Pinça multi-touch | Segundo `pointerdown` invalida o gesto inteiro | 0 segundos |
| Scroll/zoom/touchpad | `wheel` ou `movestart` invalida | 0 segundos |
| Long press, `pointercancel`, clique sem pointer, clique atrasado | Fora das condições | 0 segundos |
| Controles acessíveis separados do globo | Botão +1 explícito | +1 segundo pelo botão, sem depender de pointer events do mapa |

O evento de MapLibre só é aceito se ocorrer até **650 ms após o pointer up** e a no máximo **22 px** da coordenada do fim do gesto. O candidato é **consumido uma única vez**, impedindo duplicidade por eventos repetidos. As coordenadas são efêmeras em CSS pixels e nunca enviadas ao servidor.

## Separação entre gesto e regra de negócio

O reconhecedor informa apenas se um gesto é elegível; não conhece hashtags, segundos ou geografia. A seleção e o crédito permanecem no React e no contrato temporal em `src/timeCredit.ts`. **Um tap não modifica a contagem de participantes ou a área de luz.** O contrato de saldo decrescente da versão real continua em `docs/14-time-credit-contract.md`. O contador da POC é local e explícito.

## Limites e aceitação

- [x] Testes unitários: mouse/touch intencional, pequenos movimentos, drag, pinch, scroll, cancelamento, long press, clique duplicado, evento atrasado.
- [x] Teste browser Playwright: UI em cenários com zero participantes; gesto no canvas real, drag e scroll não devem aumentar os segundos.
- [ ] Confirmar Chromium desktop/mobile pela CI deste PR.
- [ ] Testar em notebook com touchpad físico e em celular físico; Playwright emula hardware, não reproduz todas as formas de gesto nativo.
- [ ] Inspecionar tela com hotspots overlapping: resolver conflitos de cor na #32; este PR não decide qual hashtag vence num hotspot sobreposto.

## Não alterado

Números sintéticos, shaders/heatmaps, geolocalização, Neon, saldo em produção, APIs, DNS ou hospedagem. O site de produção não deve mudar até avaliação deste PR.
