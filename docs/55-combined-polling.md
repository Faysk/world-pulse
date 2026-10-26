# 55 — Um polling para mapa e Top 10

26/10/2026 · #147 / #156 · milestone v0.4.

## Comportamento

Com geografia disponível e Top 10 aberto, o timer do mapa passa a atualizar os
dois agregados por `GET /api/pulse` a cada cinco segundos. Não existe um segundo
timer de ranking nesse modo. Abrir o painel faz leitura imediata; fechar volta
ao endpoint regional compacto, sem continuar calculando ranking oculto. Sem
geografia, o painel mantém seu endpoint de ranking e timer próprios.

Abas ocultas continuam suspendendo as consultas; retorno/foco reconcilia a sessão
e atualiza o painel aberto. O cooldown de sobrecarga e deduplicação em voo de #152
continuam valendo. Alterações de seleção/taps atualizam apenas ranking, sem
adicionar consulta regional a cada sincronização. O retorno de um ranking mais
antigo não sobrescreve um ranking com `asOfMs` mais recente.

| Estado visível em regime estável | Antes | Agora |
| --- | --- | --- |
| Mapa, Top 10 fechado | 12 GET/min | 12 GET/min |
| Mapa + Top 10 aberto | 24 GET/min | 12 GET/min |
| Mapa + Top 10 + países | 36 GET/min | 24 GET/min |
| Aba oculta | 0 GET/min de polling | 0 GET/min de polling |

São taxas do feed sem contar abertura/foco, mutações, sessão ou retries. Não
prometer reduzir pela metade todos os requests/fatura do projeto. Países conserva
seu endpoint e consulta apenas enquanto aberto. Taps continuam provisionais
instantaneamente e são enviados em lotes no fluxo existente.

## Contrato e privacidade

`pulse_snapshot_v1` contém `regions` no formato compacto v1 e `ranking` no contrato
ativo existente. Não contém sessão, identificadores individuais ou coordenadas.
O servidor cobra **um request e dois reads lógicos**, com os mesmos limites
600 reads/min, 3.000 requests/min e 50.000 requests/dia. Não transforma dois
datasets em uma leitura barata para artificialmente aumentar a capacidade.

As duas cobranças de reads usam a mesma transação limitada do budget. Quando só
resta um crédito de read, a tentativa combinada é recusada, podendo consumir esse
crédito antes da segunda cobrança falhar; é conservador, nunca ultrapassa 600.
Requests negados continuam contados. Snapshot regional e ranking usam suas
transações curtas próprias; nenhuma espera de rede fica dentro de uma transação.

O mapa mantém TTL 5 s, no-store, cap 2.000 e a mesma trava/invalidação de retirada.
O ranking possui seu próprio `asOfMs`: os dois agregados não alegam um instante
SQL único. Não há cache de sessão, CDN ou armazenamento de snapshots no navegador.
Revisão local impede resposta anterior à retirada de repor uma região na tela.

Falha em um agregado não apaga o outro: resposta parcial marca explicitamente
`snapshot_unavailable` na metade ausente. A UI limpa o mapa indisponível ou marca
erro de ranking; não inventa dados. Se ambos falham, HTTP 503 e backoff. Portanto
HTTP 200 parcial não significa dois agregados saudáveis; testes inspecionam ambos.

Clientes antigos continuam usando endpoints anteriores sem alteração. Cliente
novo em servidor anterior tenta `/api/pulse` uma vez e recorre a endpoints
separados somente em 404/405; não faz fallback de 429/503/401 para furar limites
ou gates. Esse modo de compatibilidade dura até recarregar a página e não tem a
economia combinada. Payload inválido é recusado, não interpretado como vazio.

## Validação

Testes de navegador contam chamadas durante doze janelas de cinco segundos,
fecham/reabrem o painel, ocultam/retomam a aba e verificam que seleção atualiza
ranking sozinho. O relógio é pausado após o bootstrap: tempo gasto em cliques
mobile não pode avançar acidentalmente além do Retry-After testado.

Testes de contrato cobrem formato, parcial, quotas lógicas, fallback e rejeição
de payload inválido. SQL real testa limite concorrente no último crédito. O fluxo
HTTP com PostgreSQL exercita ponto ativo, retirada imediata, preservação de saldo
e expiração natural na próxima janela, sem invalidar cache manualmente.

O harness de capacidade acrescenta map-ranking-combined aos perfis anteriores
para medir HTTP, SQL, bytes e budgets sem produção ou secrets. Quotas permanecem
inalteradas; o limite lógico de reads continua. Não é arquitetura de broadcast:
várias pessoas ainda causam consultas distintas. Feed compartilhado, viewport
e deltas permanecem avaliação de #147, sem contratar/criar outro provedor agora.
