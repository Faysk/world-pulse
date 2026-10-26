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

Rodadas são sincronizadas: um estresse de chegada simultânea, não uma distribuição
orgânica de visitas. Estatísticas do dataset são analisadas antes dos cenários.

Artefatos JSON registram SHA, ambiente, latência p50/p95/p99 total e por status (para
não confundir 429 rápido com sucesso rápido), status/erros, bytes
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

O teste não autoriza aumentar quotas nem habilitar cache público sem preservar
retirada de localização. Após a correção, o CI também exige 100% de respostas 200
nas rajadas frias, que ficam abaixo dos budgets; medir 503 e encerrar verde não é
mais suficiente. O modo de cadência continua aceitando e distinguindo 429 esperados.

## Resultado — 26/10/2026

A referência usou o código anterior ao PR #146; a correção espera pela trava
transacional por até 1s e relê relógio/cache antes de reconstruir. Mantém as
mesmas travas dos invalidadores, no-store, validade de 5s e budgets. Não há CDN,
serviço novo, mudança de migração ou participantes sintéticos em produção.
Invalidações por retirada/atualização podem exigir novo rebuild na mesma janela;
o compartilhamento não pode impedir que dados retirados sejam descartados.

As duas medições usaram o mesmo workload/dataset, budgets, Node 24.21 e PostgreSQL
18.6, mas runners com modelos de CPU distintos. Os resultados demonstram a
correção de respostas e o limite de orçamento; não atribuir um percentual de
ganho de velocidade às diferenças de latência entre essas máquinas.

### Cadência de mapa, 12 rodadas por aba em uma janela real de um minuto

| Abas HTTP virtuais | Pedidos | Antes: 200 / 503 / 429 | Depois: 200 / 503 / 429 |
| ---: | ---: | ---: | ---: |
| 1 | 12 | 12 / 0 / 0 | 12 / 0 / 0 |
| 10 | 120 | 17 / 103 / 0 | 120 / 0 / 0 |
| 25 | 300 | 252 / 48 / 0 | 300 / 0 / 0 |
| 50 | 600 | 573 / 27 / 0 | 600 / 0 / 0 |
| 100 | 1200 | 585 / 15 / 600 | 600 / 0 / 600 |

### Cadência de mapa + Top 10 aberto

| Abas HTTP virtuais | Pedidos | Antes: 200 / 503 / 429 | Depois: 200 / 503 / 429 |
| ---: | ---: | ---: | ---: |
| 1 | 24 | 24 / 0 / 0 | 24 / 0 / 0 |
| 10 | 240 | 222 / 18 / 0 | 240 / 0 / 0 |
| 25 | 600 | 585 / 15 / 0 | 600 / 0 / 0 |
| 50 | 1200 | 598 / 2 / 600 | 600 / 0 / 600 |
| 100 | 2400 | 600 / 0 / 1800 | 600 / 0 / 1800 |

Os 503 acima eram `geography_refreshing`; 429 são `operation_budget_exhausted`.
Nenhuma janela medida cruzou o minuto. Rajadas frias, três repetições por escala:
mapa passou de 84 erros 503 em 558 pedidos para zero; mapa+ranking, de 40 em 1116
para zero. Isso é um estresse sincronizado reproduzível, não taxa de erro esperada
do público em horários distribuídos.

### Gargalos que permanecem

Cada GET abre três transações: budget de requests, budget de reads e dados/cache.
Com uma aba/mapa foram 36 transações e 156 chamadas SQL no minuto da referência.
A correção adiciona releitura somente ao caminho sem cache; não é alegação de
redução de SQL, CU ou fatura. Com 50 abas/mapa, ainda são 1800 transações/min.

O payload regional de 1000 grupos teve 127.988 bytes de JSON decodificado por
resposta, cerca de 1,46 MiB/min por aba em 12 respostas bem-sucedidas. Não são
bytes faturados: gzip, protocolo e tráfego entre provedores não foram medidos.
Um cache SQL evita parte da agregação; não elimina a requisição, os budgets nem
o transporte do payload. Ainda há cap global de 2000 pares célula/hashtag.

O cenário é otimista: não inclui taps, criação/retorno de sessões, foco,
reabertura de painéis ou atualização de localização, que acrescentam operações.
Não declarar suporte geral a 50 ou 100 pessoas com base nessas abas virtuais.
Próxima frente: [#147](https://github.com/Faysk/world-pulse/issues/147), comparar
backoff/Retry-After, projeções/deltas e distribuição compartilhada com retirada,
expiração e clientes antigos preservados. Medição financeira real segue em #7.

### Recibos e dados completos

- Referência de rajada: [40365468084](https://github.com/Faysk/world-pulse/actions/runs/40365468084).
- Referência de cadência: [40365801016](https://github.com/Faysk/world-pulse/actions/runs/40365801016).
- Correção em rajada: [40366370218](https://github.com/Faysk/world-pulse/actions/runs/40366370218).
- Correção em cadência: [40367465740](https://github.com/Faysk/world-pulse/actions/runs/40367465740).
- SQL real: [40366370095](https://github.com/Faysk/world-pulse/actions/runs/40366370095), 25 testes, incluindo
  vinte leitores concorrentes, um rebuild por janela, timeout/rollback e retirada
  entre primeira leitura e reconstrução sem ressuscitar ponto ou perder saldo.
- UI/build desktop/mobile: [40366369970](https://github.com/Faysk/world-pulse/actions/runs/40366369970).

Os oito JSONs agregados, sem payloads/IDs pessoais, estão versionados em
`docs/assets/capacity-2026-10-26/`, preservando a evidência após expirar o artifact
de sete dias do Actions. Incluem latências por status, bytes, SQL e ambiente de
cada execução. As provas de staging/publicação são registradas após a verificação.

Staging real após a correção: [40369249904](https://github.com/Faysk/world-pulse/actions/runs/40369249904),
quatro testes desktop/mobile e seis sessões sintéticas removidas. Preview Vercel:
[40370140699](https://github.com/Faysk/world-pulse/actions/runs/40370140699), HTTPS/assets,
duas sessões API, retorno/retry/consentimento, acesso temporário revogado e duas
fixtures removidas. A branch de staging foi sincronizada por merge, sem force,
e sua árvore foi conferida idêntica à main revisada antes da publicação.

Produção: [40370500062](https://github.com/Faysk/world-pulse/actions/runs/40370500062),
app `6a39552`, deployment `dpl_m7rusjogPfxGCJbcRA8t6NkFTU2p`, candidato testado antes
da promoção e HTTPS/assets/API conferidos. Um GET público independente em
`/api/regions` confirmou HTTP 200, `region_snapshot`, `Cache-Control: no-store` e
validade de 5000ms. A leitura retornou zero células ativas naquele momento; não
foram criados participantes de teste em produção nem feito teste de carga nela.

Fundamento das travas/limites: [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
e [lock_timeout](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-LOCK-TIMEOUT).
