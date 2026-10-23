# Laboratório de população — 24/10/2026

Issue #30 · milestone **v0.1 — Living Earth (Visual POC)**.

## O que o teste representa

O laboratório permite escolher todos os totais pedidos, de zero a 8 bilhões,
mais 1 trilhão como estresse sintético. Cada cenário reparte o total exato entre
três hashtags e 21 regiões artificiais, com até 36 células por região.
São pessoas sintéticas agrupadas, não um censo nem contas reais.
Nesta simulação os grupos são disjuntos; no produto uma pessoa poderá participar
de várias hashtags, portanto somar contagens por hashtag não dará usuários globais únicos.

Há duas distribuições com o mesmo total por hashtag: regiões espalhadas e todos
os grupos na região de São Paulo. A distribuição fica fixa ao mudar o total para
comparar densidade sem alterar a localização. O mapa usa no máximo 756 pontos,
mesmo no cenário de 1 trilhão. Não há alocação de um objeto por pessoa.

## Tratamento visual por escala

| Participantes | Células | Tratamento / leitura |
| ---: | ---: | --- |
| 0 | 0 | Sem manchas; luzes decorativas desligadas ao selecionar o cenário. Navegação continua. |
| 1 | 1 | Núcleo de 2,5 px no zoom global; sinal discreto em São Paulo, sem iluminar uma região inteira. |
| 10 | 10 | Sinais esparsos, alguns no hemisfério oposto; não esperar ver dez pontos simultaneamente. |
| 100 | 21 | Grupos pequenos e separados; ponto representa pessoas agregadas. |
| 1.000 | 92 | Núcleos começam a formar manchas regionais. |
| 10.000 | 673 | Mais células preenchem as mesmas regiões e as manchas se unem localmente. |
| 100.000 | 756 | Limite geométrico atingido; aumentos seguintes alteram peso, não quantidade de pontos. |
| 1.000.000.000 | 756 | Densidade comprimida e brilho limitado preservam a cartografia. |
| 8.000.000.000 | 756 | Mesmo orçamento de geometria; total compacto no ranking e exato no laboratório. |
| 1.000.000.000.000 | 756 | Identificação explícita de estresse acima da escala humana; sem desenhar um trilhão de pontos. |

O laboratório pode ser recolhido também no desktop para não encobrir o sinal
único. No celular os painéis começam recolhidos. Pontos esparsos desaparecem
gradualmente entre zoom 5 e 7 enquanto halos e núcleos detalhados aparecem.
Selecionar uma hashtag destaca sua cor; na distribuição concentrada o foco
vai para a concentração sintética, não para a cidade original daquela hashtag.

## Evidência e reprodução

`npm run check`: contagens inteiras exatas, coordenadas válidas, determinismo,
limite de geometria e preservação dos totais nas duas distribuições, além dos
testes existentes de taps e saldo cronológico.

`npm run test:browser`: MapLibre/WebGL real, mas com estilo cartográfico mínimo
local para não depender do fornecedor de tiles. Capturas de todos os dez
cenários em desktop e celular, mais concentração de 1 trilhão, ficam em
`test-artifacts/scenario-*.png` e no artefato `world-pulse-browser-smoke` do Actions.
Também houve inspeção no Chrome com o estilo real do OpenFreeMap.

`node --experimental-strip-types scripts/population-benchmark.mjs` mede 100 gerações
de GeoJSON por combinação. Na execução local Windows/Node, distribuição espalhada:
1 pessoa = 207 bytes; 100 mil = 135.102 bytes; 8 bilhões = 138.666 bytes;
1 trilhão = 140.394 bytes. Medianas observadas entre 0,005 e 0,040 ms por geração.
Esses tempos medem somente geração sintética em memória; não incluem serialização,
transferência, workers, GPU, tiles, banco ou concorrência de usuários reais.

## Avaliação crítica

- Acima de 100 mil, as imagens ficam progressivamente semelhantes: as mesmas 21
  regiões já estão preenchidas e a escala de brilho satura deliberadamente.
  A imagem sozinha não permite distinguir com precisão 1 bilhão de 8 bilhões;
  o contador é necessário. Não interpretar área iluminada como área habitada real.
- Na concentração extrema, a última camada de heatmap pode dominar outra cor.
  Destacar uma hashtag ajuda a inspecionar, mas não resolve a composição de muitas
  hashtags coincidentes. Este limite permanece registrado em issue própria.
- Ainda não é agregação espacial por zoom: aproximar não revela novos indivíduos.
  Para dados reais precisamos células por nível de detalhe, origem/limites por
  viewport e orçamento de payload; não multiplicar os pontos até bilhões.
- Três passes de heatmap servem às três hashtags da demonstração. Não escalam
  automaticamente para milhares de hashtags ou oito bilhões de conexões.
- O teste valida representação visual agregada, não capacidade do backend ou
  gratuidade nessa escala. O fluxo real segue o contrato de saldo cronológico.
