# 28 — Benchmark CPU dos cenários completos

Execução local em 24/10/2026: Node v22.23.1, Intel Core i7-14700HX. Script
`scripts/spatial-benchmark.mjs`, versão que usa a lista canônica de cenários.

- 0, 1, 10, 100, 1.000, 10.000, 100.000, 1 bilhão, 8 bilhões e 1 trilhão.
- Duas distribuições (dispersa/concentrada), três zooms e três orçamentos de células.
- 180 combinações; 30 iterações por combinação. Totais inteiros e geometria
  limitada verificados em cada uma; não se cria um objeto por pessoa representada.
- Maior p95 observado entre as combinações: **1,352 ms** para agregação CPU.
- Maior saída observada: **181 células / 39.520 bytes JSON**.

[CSV completo da execução](assets/spatial-benchmark-2026-10-24.csv).

Isso NÃO mede FPS/WebGL, GPU, celular físico, rede/tiles, simultaneidade do
backend ou capacidade de servir bilhões de usuários. São contagens sintéticas
agregadas em até 756 células de entrada. O spike de agregação não está ligado
à renderização pública; composição de cores e teste gráfico continuam em #32
/#12. Este benchmark só demonstra o custo da transformação CPU/JSON descrita.
