# Leitura limitada de saldos sem perda de tempo (#79)

Uma sessão pode ter mais de 200 hashtags no histórico. O banco preserva todas;
a resposta da interface é limitada para não crescer sem controle. O corte antigo
por ID podia preencher a lista com históricos expirados e ocultar saldo positivo
ou a hashtag selecionada, criando aparência de zero até uma sincronização futura.

Agora a leitura prioriza a hashtag selecionada, depois os saldos positivos, maior
expiração e ID como desempate. Consulta até 201 linhas: sessão e seleção devolvem
até 200, com `creditsHasMore=true` quando existe outra. O painel informa a limitação
e explica que selecionar uma hashtag recupera seu saldo confirmado. Nenhuma linha
é apagada, consolidada ou alterada por essa leitura. Ranking e mapa continuam
contando todos os saldos positivos do banco, independentemente do corte da lista.

`POST /api/select` inclui essa fotografia, para que o cliente atualize o saldo
escolhido imediatamente. Cliente com servidor anterior faz refresh de sessão como
compatibilidade, sem inventar créditos. Alterar seleção não adiciona segundos.
O relógio de cada saldo continua partindo do snapshot do servidor recebido pelo
cliente; expiração e aceitação de taps são sempre decididas pelo banco.

Verificações: PostgreSQL com 205 históricos, hashtag fora da antiga janela e
saldo positivo; contratos HTTP com uma linha extra; cliente sem criar taps;
dois navegadores/emulação desktop/mobile com histórico grande, reentrada, aviso
de limite e total de segundos intacto. Não é paginação completa nem um limite de
quantas hashtags a pessoa pode manter: é somente uma janela explícita de exibição.
