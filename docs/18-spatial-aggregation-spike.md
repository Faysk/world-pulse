# 18 — Agregação espacial por zoom (experimento isolado, issue #32)

Este documento acompanha `src/spatialAggregation.ts` e os testes de `tests/spatialAggregation.test.mjs`. **A visualização publicada do World Pulse não foi alterada.**

## O problema

Nos cenários de 100 mil até 1 trilhão de participantes **sintéticos**, a POC preenche as mesmas 756 células de origem: aumentos grandes ficam parecidos. Quando hashtags sobrepõem a mesma área, o último heatmap desenhado pode encobrir os anteriores. Expandir dados até um ponto por pessoa é inviável, invasivo e não resolveria a composição de cores.

## Primeiro corte: grade Mercator determinística

A função `aggregateForZoom(population, {zoom,maxCells})` recebe **pontos regionais já agregados**, com uma contagem de participantes por hashtag.

1. Começa numa grade Web Mercator de nível `floor(zoom)+1`, limitada a 14.
2. Usa chaves `hashtag / célula_x / célula_y`. Células de hashtags diferentes nunca se fundem na mesma contagem.
3. Se o número de células ultrapassar o orçamento, **reduz o nível de detalhe**, recompõe toda a grade e repete até respeitar o teto.
4. Nunca amostra ou descarta participantes. Se o teto for impossível até no nível mais amplo, retorna erro explícito em vez de fabricar números.
5. A localização exibível é o **centro da célula regional**, nunca a média das coordenadas dos participantes. Isso evita publicar um centroide potencialmente identificável de apenas uma amostra.
6. Mantém a contagem total e por hashtag inteira e exata, enquanto a soma permanecer em `Number.MAX_SAFE_INTEGER`. Acima disso, a aplicação futura deverá usar bigint/decimal do banco.
7. A ordem de entrada não influencia os resultados: a saída é ordenada por tile e hashtag.

**Importante:** grade Mercator e centroides regionais não garantem sozinhos privacidade suficiente. Uma hashtag de grupo pequeno ainda pode revelar uma região sensível. Política geográfica, supressão ou generalização e retenção continuam na issue #6.

## Colisões e cores

A função `describeOverlaps()` registra todas as hashtags que caíram no mesmo tile, com cor, contagem e fração, ordenadas determinísticamente por hashtag. Isso permite testar uma composição futura por setores/contorno/máscara **independente da ordem original de dados**.

Ela **não implementa o shader** nem resolve visualmente a composição de cores. A POC ainda contém três passes de heatmap. O passo seguinte é comparar visuais e performance da composição em canvas/WebGL, preservando matizes e impedindo que uma última camada esconda todas as demais.

## Como testar

```sh
npm ci
npm run check
npm run benchmark:spatial
```

Testes cobrem 0, 1, 10, 100, 1.000, 10.000, 100.000, 1 bilhão, 8 bilhões e 1 trilhão (distribuídos e concentrados), zooms de 0 a 14, orçamento máximo, preservação exata dos totais por hashtag, determinismo ao inverter a entrada, meridiano 180°, latitude alta e erros de contrato.

O benchmark `scripts/spatial-benchmark.mjs` gera linhas CSV de **30 execuções por configuração**, contagem de células, bytes JSON e tempo p50/p95 de agregação em memória.

### Limitações obrigatórias

- Não mede shader, FPS, VRAM, tiles, transferência HTTP nem banco.
- O benchmark tem apenas 756 células de origem; isso não demonstra que a infraestrutura atenderá bilhões de usuários.
- A versão publicada ainda não utiliza a agregação por viewport/zoom. **A API real não deve expor células sem aplicar a política de privacidade da issue #6.**
- O orçamento atual vale para o conjunto completo; a próxima iteração precisa de paginação espacial por viewport/tiles e avaliação do cache.
- Ainda falta construir/avaliar o compositor multicolorido de um único passe GPU, e garantir seleção de tags em células sobrepostas sem confundir uma pessoa com múltiplas contagens.

## Critérios ainda abertos na issue #32

- [x] Agregação por nível de detalhe, com teto de células e soma exata por hashtag.
- [x] Detecção determinística das cores que disputam a mesma célula.
- [x] Testes de cenários extremos e ferramenta de benchmark CPU/payload.
- [ ] Pipeline backend de agregação por viewport com privacidade e cache.
- [ ] Compositor GPU multicolorido comprovadamente independente da ordem das camadas.
- [ ] Capturas comparativas de alto zoom, desktop e mobile; benchmark real de FPS/GPU.
- [ ] Integração no globo somente depois de revisão visual.

Este trabalho é um **spike técnico**, não uma mudança do visual aprovado nem a conclusão da issue #32.
