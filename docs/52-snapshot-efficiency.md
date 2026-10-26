# 52 — Eficiência das leituras sem cache público de localização

26/10/2026 · #147 / #152 · milestone v0.4.

## Entrega

O cliente compartilha o cooldown entre leituras de mapa, ranking e países.
429/503 respeitam Retry-After em segundos ou HTTP-date, inclusive respostas
não JSON de um proxy. Falhas de rede usam espera exponencial de 5 até 60 s.
Foco, abertura de painéis e atualizações após mutação não furam essa pausa.
Uma leitura em voo por rota atende chamadas concorrentes. Não há persistência
de snapshots; POSTs de taps, sessão e retirada de localização são independentes.
Ao voltar ao polling após o prazo, uma nova leitura pode ocorrer normalmente.
Abas ocultas continuam sem polling. Isto não coordena diferentes abas/aparelhos.

O header opt-in `X-WP-Region-Format: compact-v1` pede um dicionário de hashtags
e tuplas `[célula, índice da hashtag, participantes]`. Não há perda de precisão
numérica: contagens continuam strings. O cliente expande e valida com as mesmas
regras do snapshot anterior. Servidor novo atende clientes antigos com o formato
original; cliente novo também aceita servidor antigo. Nenhuma migration.

TTL de 5 s, no-store, trava de reconstrução/retirada e cap de 2.000 grupos são
preservados. Cada resposta contém todos os grupos; não há delta que dependa de
estado antigo, ETag/304 ou cache CDN capaz de reapresentar uma localização retirada.
O mapa limpa o snapshot após falha, inclusive durante backoff.

Requests e reads são cobrados na mesma transação limitada: duas consultas de
budget continuam existindo, mas há um checkout/BEGIN/COMMIT a menos por GET.
Uma negação de reads confirma a cobrança de requests antes de devolver 429,
como antes. Erro de SQL reverte a transação e falha fechado. Quotas não aumentam.

## Medição

O teste local com 1.000 grupos, dez hashtags e contagens grandes preservou todos
os campos: 154.960 bytes no formato antigo, 52.591 no compacto (66,1% menos).
São bytes JSON decodificados de um fixture específico, sem gzip/TLS; com hashtags
quase únicas a economia será menor. Não é redução comprovada de fatura.

O harness #143 agora também executa map-compact e map-ranking-compact, mantendo
os perfis antigos, SQL real e limites. A cadência saudável continua 5 s; o ganho
de requests vem de não repetir leituras durante falhas e deduplicar concorrência,
não de prometer multiplicar o orçamento de 600 reads/min. Cenários saudáveis
com 100 abas ainda podem esgotá-lo. Recibos reais de CI serão anexados à issue.

## Próxima decisão de transporte

| Alternativa | Benefício | Custo/condição antes de adotar |
| --- | --- | --- |
| Compactação por resposta (adotada) | Reduz repetição sem estado adicional | Não reduz cadência saudável nem linhas SQL |
| Filtro por viewport/zoom | Evita enviar pontos fora da vista | Precisa agregação em zoom baixo, antimeridiano e sinal explícito de truncamento; não apenas esconder cap global |
| Deltas versionados | Reduz bytes quando poucas células mudam | Requer tombstones de retirada/expiração, resync e versões antigas; um delta perdido não pode manter ponto |
| Feed compartilhado/stream | Pode reduzir consultas repetidas ao Neon | Fan-out, reconexão e retirada precisam uma autoridade única e testes; custo de conexão/duração conta |
| Cache CDN | Reduz chamadas à origem | Não adotado: invalidação de consentimento precisa prova antes de qualquer cache público |

Não contratar nem migrar agora apenas por uma estimativa de requests. A próxima
prova deve comparar feed compartilhado com viewport/deltas usando as mesmas
fixtures, inclusive sessões/taps e retirada concorrente. Serviços gratuitos têm
limites próprios, não substituem o orçamento da aplicação.

Fontes verificadas em 26/10/2026: [runtimes Vercel](https://vercel.com/docs/functions/runtimes),
[preços/limites Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/)
e [planos Neon](https://neon.com/docs/introduction/plans).
Durable Objects tem plano Free para SQLite, com limites diários e falha ao excedê-los;
uma troca exigiria Worker/namespace e nova operação, além de medir o acesso ao Neon.
Nenhum desses serviços foi criado nesta entrega.
