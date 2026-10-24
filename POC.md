# Living Earth — Visual POC v0.1

**Status em 24/10/2026:** demonstração publicada em [map.faysk.dev](https://map.faysk.dev), integrada em `main`. **Nenhum usuário real, banco de dados ou geolocalização automática está conectado.**

## Como executar

Requisitos: Node compatível com `package.json` (^22.16 ou >=24) e npm. Com internet para dependências e mapas:

```bash
npm ci
npm run dev
# http://localhost:5173
```

Compilar e verificar tipos:

```bash
npm run test
npm run build
npm run preview
```

## O que já existe neste protótipo

- **MapLibre GL JS 6.15** com globo e base cartográfica progressiva [OpenFreeMap Dark](https://openfreemap.org/quick_start/).
- Estilo cinza aplicado aos layers de base após carregar.
- **Três hashtags simuladas** com cores fixas exclusivamente para a demonstração.
- Camadas de heatmap independentes por hashtag, com pesos geográficos baseados em **pessoas distintas simuladas**.
- Luzes urbanas decorativas discretas (liga/desliga), **não dados de participantes reais**.
- Controle de intensidade das populações de teste, animação de crescimento e seleção de uma hashtag para destaque.
- Navegação no mapa por mouse/touch/pinça, zoom e retorno à vista global.
- **LOD das luzes:** manchas heatmap mais amplas ao ver o planeta e focos luminosos menores ao aproximar, com transição gradual.
- **Seleção no globo:** tocar/clicar em uma região luminosa aproxima a interação à hashtag subjacente. O primeiro toque seleciona, o seguinte no mesmo # credita +1 segundo.
- Tratamento de alterações dos controles mesmo que aconteçam antes do carregamento inicial do mapa.
- Estilo de rótulos geográficos suavizado na visão global, mantendo leitura de cidades em aproximações.
- Testes de domínio com Node Test Runner (`npm run test`), executados na GitHub Action.
- Teste local de clique curto: **+1 segundo** apenas no estado do frontend da hashtag selecionada; nunca altera densidade.
- Painel de dados simulados, zoom e amostragem aproximada de frames de renderização.
- Layout responsivo em PC/mobile.

## Não há ainda

**Não há persistência do contador:** segundos do demo desaparecem ao recarregar, conforme esperado nesta prova visual. A POC não usa API de participação, ID de usuário, geolocalização real ou ranking real. Cloudflare DNS/R2 e Neon já estão provisionados, mas o frontend ainda não grava participação nesses serviços. A API experimental está em draft no PR #31. A interface não pode ser confundida com participação real.

## Como testar

1. Abra o mapa e gire/aperte zoom. Verifique **nitidez progressiva** do mapa ao aproximar.
2. Com "Todas", observe laranja, verde e violeta em várias regiões.
3. Selecione uma hashtag no painel lateral. A câmera aproxima a principal concentração.
4. Mude a intensidade de 0 a 300%: as manchas alteram brilho e extensão por aumento de **pessoas simuladas**.
5. Escolha uma hashtag no ranking ou toque em uma luz do globo para selecioná-la. Toque novamente no mesmo foco luminoso para acrescentar +1 segundo local. Um clique em terreno não iluminado com hashtag selecionada também soma +1. **Arrastar e pinch não** devem adicionar.
6. Alterne `#GTA6` e `#Minecraft` e confirme segundos locais independentes.
7. Desative luzes urbanas de fundo e compare legibilidade e atmosfera.
8. Abra DevTools: medir WebGL, tiles, memória, erros e performance.

## Estrutura do frontend publicado

```
src/
  main.tsx          boot React
  App.tsx           painel / controles / estado local
  WorldGlobe.tsx    MapLibre / layers / câmeras e eventos
  demoData.ts       pontos sintéticos determinísticos
  styles.css        UI visual, responsividade
```

## Observações e riscos

- A base OpenFreeMap depende de internet e da disponibilidade/termos do serviço de tiles.
- A seleção por região luminosa usa uma camada invisível de círculos sobre os pontos espaciais simulados. Nem toda parte do gradiente visual possui uma área interativa nesta POC; ampliar para campo clicável completo pode exigir hit-testing espacial específico.
- Múltiplos heatmaps nativos, um por hashtag, são aceitáveis **apenas para poucas hashtags**. POC posterior deve comparar shader único/texturas agregadas para volume elevado.
- A cor fixa por hashtag neste experimento é seed de teste; no produto real será **sorteada na primeira criação e persistida**.
- A simulação altera contagens de **participantes agregados**, nunca taps. Cenários exatos usam no máximo 756 células, inclusive com 8 bilhões ou 1 trilhão sintéticos.
- Um perfil de GPU/dispositivo pode exibir FPS inferior ao alvo; o indicador `FPS*` é apenas taxa de frames renderizados, não instrumento formal de benchmark.
- Não há garantia de bairro em IP geolocation. Dados de teste usam cidades conhecidas, **sem representar pessoas individuais**.
- Os nomes e dados simulados estão marcados permanentemente como DEMO.
- O visual atual **não comprova** ainda qualidade final de noite realista / shader ou competição de mil hashtags.

## Validação e limites

O [CI dos cenários](https://github.com/Faysk/world-pulse/actions/runs/40040810994)
passou em desktop e celular emulado. O WebGL é real, mas o estilo cartográfico do
CI é mínimo/local. Também houve inspeção no Chrome com OpenFreeMap real; as
capturas estão na [análise de população](docs/15-population-scenarios.md).

A [publicação pelo Actions](https://github.com/Faysk/world-pulse/actions/runs/40041911767)
validou HTML/JS/CSS antes de promover o deployment e confirmou o domínio público.
Teste em celular físico, benchmark gráfico e composição de muitas hashtags
continuam pendentes (#12/#32). Bundle MapLibre ainda é grande; o indicador FPS
não constitui benchmark. [Arquitetura operacional atual](docs/05-free-tier-architecture.md).

## Próximos testes

- [#1 — Motor e qualidade de zoom](https://github.com/Faysk/world-pulse/issues/1)
- [#2 — Manchas e densidade](https://github.com/Faysk/world-pulse/issues/2)
- [#10 — Night Lights](https://github.com/Faysk/world-pulse/issues/10)
- [#11 — Frontend](https://github.com/Faysk/world-pulse/issues/11)
- [#12 — Benchmark e preview Vercel](https://github.com/Faysk/world-pulse/issues/12)
