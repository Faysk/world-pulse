# 21 — Rotação de sessão e sincronização entre abas (issues #5 e #20)

**Status:** implementação isolada na branch experimental da API. Não publicada em `map.faysk.dev`; `WP_API_ENABLED` permanece desligado na produção.

## Risco corrigido: taps órfãos depois da expiração do cookie

A identidade anônima vive num cookie `HttpOnly`. Uma aba pode perder conexão com taps locais pendentes e retornar após a expiração da sessão. Sem proteção, o endpoint `POST /api/session` pode emitir outro cookie, permitindo acidentalmente reencaminhar um lote do participante anterior como se pertencesse à identidade nova.

Agora o servidor devolve `sessionFresh: true` quando emite uma sessão nova e um `sessionBinding` não autenticador derivado do token aleatório do cookie por SHA-256 com separação de domínio. O cliente guarda a fila num **envelope v2** contendo o binding original e os lotes; ao observar sessão nova **ou binding divergente**, bloqueia a sincronização e coloca a fila em **quarentena**. Isso cobre inclusive outra aba renovando o cookie antes de a aba com taps fazer uma requisição (nesse caso `sessionFresh` pode ser falso). A quarentena é persistida separadamente dos lotes e permanece depois de recarregar a aba. O binding não é aceito pelo servidor como autenticação nem devolve o ID do visitante; é um marcador pseudônimo local, que não deve aparecer em logs ou APIs públicas.

- `flush()` e `creditClick()` param enquanto há quarentena.
- Antes de transmitir lotes, o cliente revalida o binding da sessão atual pelo servidor. **Cada `POST /api/taps` também carrega `X-WP-Session-Binding`**, e o handler compara esse marcador com o cookie `HttpOnly` recebido **na mesma requisição**. Uma troca do cookie entre a revalidação e o envio resulta em HTTP `409 session_binding_mismatch` e o lote não entra na transação SQL. O marcador não substitui nem autentica o cookie; serve apenas para amarrar um lote local à sessão que o gerou.
- Filas legadas não vinculadas a sessão não são migradas automaticamente: são conservadas apenas para descarte explícito, para impedir replay cruzado.
- O batchId original, tagId e número de clicks não são adulterados.
- O laboratório explica claramente a perda de vínculo entre as duas sessões.
- A recuperação exige um **clique explícito** em “Descartar fila antiga e conectar nova sessão”; isso abandona os taps pendentes, mas nunca os atribui a outra pessoa.
- Resposta de `401 session_expired` ao sincronizar com pendências também entra em quarentena. Se a rede falhar sem 401, a fila continua congelada e pode ser reprocessada na MESMA sessão.
- Na versão pública futura, considerar um fluxo de recuperação com janela curta ou conta opcional; sem isso, a escolha conservadora evita transferência de crédito.

**Limite atual:** `localStorage` não fornece transações entre abas. Esta entrega garante o sincronismo **da seleção**; ela não promete sincronização perfeita de duas filas simultâneas no mesmo navegador. Coordenação multi-writer da fila e quota global permanecem em #5.

## Seleção única nas abas do mesmo navegador

O banco `world_pulse.visitors.active_tag_id` continua sendo a autoridade. O backend inclui na resposta da sessão o `activeTag` correspondente (ID da hashtag, nome e cor), sem IDs de usuário.

Quando uma aba A seleciona uma hashtag:
1. Faz `POST /api/select` para o banco.
2. Notifica outras abas via chave local `world-pulse-selection-changed-v1` (nonce, sem identidade e sem coordenadas).
3. Abas B, C etc. reconsultam `POST /api/session` para obter a seleção atual, em vez de confiar no valor do aviso.
4. Uma aba que retornou do segundo plano também revalida ao receber foco ou `visibilitychange`.
5. Atualizações locais de seleção são serializadas por cliente para evitar sobrescrever um resultado HTTP dentro da mesma aba.

A aba B pode ter lotes antigos **já atribuídos à hashtag A**, sem transferi-los ou impedir o saldo de continuar decrescendo. O sinal de sincronização não transporta tokens de cookie nem dados de localização.

## Testes

- `tests/client.test.mjs`: sessão nova com fila antiga, bloqueio após 401, persistência da quarentena e descarte explícito, reconciliação do estado selecionado pelo servidor entre duas instâncias.
- `tests/participation-browser/flow.spec.ts`: duas abas da mesma sessão selecionam hashtags diferentes e convergem ao estado do servidor; teste de cookie expirado com lote pendente bloqueia crédito cruzado e exige descarte.
- `tests/api.test.mjs`: contrato de `sessionFresh` / `activeTag`.
- CI PostgreSQL descartável com migrações 0001/0002/0003 e Chromium desktop/mobile, **sem tocar no Neon de produção**.

## Antes do lançamento

- [ ] Testar concorrência de várias abas escrevendo lotes simultaneamente e adotar armazenamento transacional/coordenação por aba.
- [ ] Política de expiração, retenção e limpeza de sessões + batches sem permitir replay de batchId removido.
- [ ] Quotas globais contra abuso, staging persistente e recuperação da sessão durante falhas prolongadas.
- [ ] Privacidade geográfica e ranking de participantes (#6/#8), não confundir métricas.
- [ ] Confirmar testes de hardware e UX final do globo.
