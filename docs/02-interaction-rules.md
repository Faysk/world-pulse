# 02 — Interação, hashtags, segundos e manchas

**Status:** regras confirmadas + aspectos não decididos explicitamente separados.

## Regras confirmadas

1. **Uma hashtag ativa por participante de cada vez.** Ao trocar de hashtag, a anterior deixa de ser a seleção ativa.
2. **Segundos por hashtag persistentes:** tempo acumulado em #A é preservado ao passar para #B e vice-versa.
3. **Cada clique/tap elegível equivale a +1 segundo de contribuição** da hashtag ativa. Não é um temporizador contínuo.
4. **Manchas dependem de pessoas distintas**, e não da quantidade de cliques, segundos ou velocidade de toque.
5. **Hashtags são livres:** não há lista fechada, limiar mínimo de votos nem filtros por enquanto.
6. **Primeiro registro da hashtag sorteia a cor; registros seguintes reutilizam a cor**, inclusive em outros países.
7. O usuário pode **selecionar hashtag existente visualmente** pela cor/mancha ou etiqueta.
8. O visitante pode observar e navegar antes de contribuir.
9. Geografia do usuário apenas aproximada, sem mostrar endereço ou ponto exato.

## Regras técnicas propostas (não ratificadas)

- Normalização de hashtags: Unicode NFC; remover espaços extras; diferenciação de maiúsculas/minúsculas desativada para chave canônica, mas preservar grafia legível.
- Limitar tamanho e caracteres aceitos, para evitar nomes quebrados, sem impor catálogo.
- IDs persistentes de navegador (pseudônimos) para manter segundos por hashtag; risco: limpar storage/trocar aparelho perde vínculo.
- Operação idempotente em lotes para evitar segundos duplicados se conexão falhar e o cliente repetir envio.
- Salvar contribuição local imediata; sincronizar lotes com servidor para reduzir chamadas.
- Tratar taps rápidos e cliques de mouse de modo equivalente.

## Conflito: clique para somar versus toque para navegar

O requisito diz `cada clique ou tap soma +1 s`. Em paralelo a pessoa precisa arrastar, dar zoom, pinçar e selecionar hashtags.

**Experimento de UX obrigatório:**
- Tap/click curto com hashtag ativa credita +1.
- Movimento acima de pequeno limiar = gesto de navegação; não soma.
- Scroll, pinch, arrastar, rotação e movimento da câmera = não somam.
- Tap sobre interface de seleção escolhe a hashtag, **não deve somar automaticamente** sem decisão explícita.
- Sem hashtag selecionada, clique no globo pode explorar, mas não credita tempo.

Precisamos validar onde o tap será aceito: superfície inteira do globo, área separada de contribuição, ou ambos. Não tratar a proposta acima como decisão fechada.

## Três contadores distintos — não misturar

- `contributors_ever`: pseudônimos distintos que já contribuíram para a hashtag; requer definição de escopo.
- `participants_present`: pseudônimos associados à hashtag atualmente; requer política de saída/expiração.
- `seconds_total`: soma histórica dos +1s recebidos por hashtag.

**Top 10:** confirmado que todas as hashtags elegíveis entram (se houver 10 ou 10 milhões); **ordenar por qual métrica ainda está em aberto**. O ranking deve explicar a métrica exibida.

## Densidade espacial

- Para cada hashtag e região, contar **participantes distintos**; não contar clicks.
- A cor deve ficar mais intensa conforme mais pessoas entram em áreas próximas.
- Se os participantes se distribuem espacialmente, a mancha acompanha essa distribuição.
- Hashtags rivais coexistem; evitar cores misturadas que se tornem ilegíveis.
- Nunca deslocar pontos para sugerir precisão residencial.

## Critérios de aceite para testes

- 1 participante com 10.000 taps altera `seconds_total` em +10.000 e **não** altera a contagem de pessoas.
- 100 participantes com 1 tap cada alteram contagem em +100 e `seconds_total` em +100.
- Alternar A→B→A mantém separadamente os segundos registrados de A e B.
- Dois navegadores diferentes podem ter IDs diferentes; chamar de **participantes identificados**, não garantia de seres humanos únicos.
