# 50 — Capacidade isolada de snapshots

26/10/2026 · #143, #7 e #13 · milestone v0.4.

O workflow `snapshot-capacity.yml` mede os handlers reais por HTTP com PostgreSQL
18 descartável, pool máximo de três conexões e budgets de produção inalterados.
Não recebe secrets nem acessa produção/staging remoto. Banco e origem HTTP são
fixos em loopback; recusa variáveis de credenciais externas e banco já populado.

O dataset contém 1000 sessões sintéticas, 10 hashtags e 1000 pares célula/hashtag
com saldo positivo. Não representa localização, dispositivo ou pessoa real.

## Cenários reproduzíveis

- `burst`: 1, 10, 25, 50 e 100 abas virtuais, três repetições, cache frio e budgets
  zerados entre cenários. Mede reconstrução/contenda, não uma taxa por minuto.
- `cadence`: mesmos números de abas; 12 rodadas a cada cinco segundos, alinhadas
  a uma janela UTC real de um minuto. Não acelera o relógio dos budgets SQL.
- Dois perfis separados: somente mapa e mapa com Top 10 aberto. Cada perfil usa
  seu próprio runner/banco. Requests públicos GET; não inclui taps/sessões novas.

Artefatos JSON registram SHA, ambiente, latência p50/p95/p99, status/erros, bytes
de JSON decodificado, chamadas SQL do app, transações, atualizações de budgets,
reconstruções/hits do cache regional, consultas de ranking e fila máxima do pool.
Consultas de setup/medição do administrador não entram nos contadores SQL do app.
Uma chamada SQL pode conter BEGIN e vários SET LOCAL: não confundir chamadas de
protocolo com número de instruções SQL. Nenhum payload/cookie/ID de sessão é
publicado no relatório. Atraso da cadência é medido; cruzar a janela invalida
o cenário de minuto para comparação com os budgets.

O CI de PR exercita rajadas; o modo completo de cadência é manual para limitar
minutos do Actions. O workflow usa somente `contents: read`, sem Environment.
Para execução local deliberada, é necessário PostgreSQL descartável preparado
como o service do workflow e `WP_CAPACITY_BENCHMARK=1`, com os perfis/modos aceitos.
Não apontar a ferramenta para serviços remotos; ela não oferece essa opção.

## Limites de interpretação

São clientes HTTP virtuais, não navegadores renderizando o globo. O gerador e a
API compartilham um processo Node local ao banco: isso não mede rede pública,
Vercel Fluid Compute/autoscaling, CU Neon, fatura, FPS, memória de celular ou
identidade de pessoas. Bytes decodificados excluem gzip, headers e TLS.
Status 429 por budget e 503 por atualização de cache são resultados medidos,
não sucesso de participação; a conclusão deve separar esses códigos.

Os resultados serão registrados antes de encerrar #143. O teste não autoriza
aumentar quotas nem habilitar cache público sem preservar retirada de localização.
