# 23 — Fila persistente coordenada entre abas

Issue #57, milestone v0.3. Integração na branch experimental da API, sem ativação pública.

## Problema

O envelope localStorage era compartilhado, mas cada aba guardava uma cópia em
memória. Ler, alterar e gravar sem exclusão mútua podia sobrescrever taps da outra
aba, ressuscitar lotes confirmados e alterar o payload de um lote já enviado.
A reconciliação da seleção entre abas não tornava a fila transacional.

## Solução

Todas as operações que podem alterar a fila ou a sessão usam o mesmo Web Lock
exclusivo por origem. O envelope é relido depois de adquirir o lock. Seleção,
conexão, refresh, adição de tap, descarte e envio não aninham locks. A persistência
continua no localStorage: fechar/abrir o browser mantém lotes não confirmados se
o armazenamento/cookie ainda existirem. O lock é liberado pelo navegador quando
uma aba é encerrada.

Envelope v3 persiste também os IDs congelados. Antes do primeiro fetch, o lote é
marcado como congelado e gravado; outra aba/reload nunca muda seu fingerprint.
Após confirmação remove-se somente o lote reconhecido dentro do mesmo lock.
A transação/idempotência do servidor continuam sendo necessárias: o lock não é
uma autorização nem substitui a verificação do cookie/binding.

`creditClick()` e `discardOrphanedPending()` agora são assíncronos. A interface
aguarda o resultado e explica falha de armazenamento. Nenhum erro de gravação
é tratado como persistência bem sucedida. A fila continua limitada a 3000 taps.

Cada fetch expira em 10s, a espera pelo lock em 30s e cada flush envia no máximo
3 lotes antes de liberar a vez para outra aba. Backlog maior continua na fila
para a próxima sincronização; não transforma saldo confirmado em estimativa.

Sem Web Locks no navegador, a fila persistente falha de forma explícita. Apenas
os testes Node usam mutex em memória; ele não é apresentado como coordenação
entre processos. Sem acesso ao localStorage, o transporte pode operar somente
em memória: fechar a aba pode perder taps não confirmados.

[Web Locks API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
explica a exclusão por origem e a exigência de contexto seguro. localhost permite
o ensaio descartável; o app remoto deve usar HTTPS.

## Verificação

- Unidade: 60 taps concorrentes em dois clientes = 60 créditos; nenhum lote
  confirmado ressuscita; outro escritor espera envio e preserva ID após perda
  de resposta; falha de quota de armazenamento é explícita.
- Playwright/PostgreSQL descartável: duas abas reais concorrentes, 60 taps;
  commit seguido de fechamento da aba antes da resposta; outro tap + retry
  resulta em 62 créditos exatos, com fila vazia.
- Testes de rotação/quarentena, seleção entre abas e duas sessões independentes
  continuam obrigatórios. Vercel não participa destes testes.

## Limites

Web Locks coordenam somente versões do cliente que respeitam o mesmo protocolo.
Uma aba antiga aberta antes desta alteração ainda pode escrever sem lock:
antes da alpha, exigir recarga de todas as abas de teste. Alteração maliciosa do
localStorage, extensões, remoção de cookie e comprovação de pessoa humana não
são resolvidas aqui. O servidor permanece a autoridade dos créditos.


Atualização #106: o POST usa lock de envio separado e deixa o lock da fila livre
para taps. ACK é por ID, nunca shift sobre uma fila alterada. [Resposta imediata
e limites atuais](40-fluid-taps-country-choice.md).
