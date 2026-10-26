# Diagnóstico da resolução do ponto salvo

Issue #129. Continuação das issues #123 e #126. Uma margem informada pelo navegador de 1 km não identifica a resolução do ponto já salvo: a primeira descreve a estimativa do sensor/provedor; a segunda é o tamanho da grade usada no envio anterior.

## Reprodução com referência pública

A referência de Cete no [Getty TGN 7743567](https://www.getty.edu/vow/TGNFullDisplay?english=N&find=7004472&nation=&place=&subjectid=7743567) é um ponto público da localidade, não coordenadas do usuário. Aplicando a grade histórica, ela cai em `r1:262:257`, cujo centro fica a mais de 20 km dessa referência, na área de Moreira. Isso é compatível com a imagem relatada. A grade r2 produz centro a menos de 1 km da referência.

Essa reprodução demonstra uma hipótese concreta de ponto legado; não comprova qual versão foi usada pelo aparelho nem descarta erro do provedor. Não deslocamos o ponto para Cete por suposição.

## Interface

- A ajuda (?) mostra **Região do ponto salvo: ~55 km** para r1 ou **~1 km** para r2. Não exibe coordenadas, código da célula ou identificador de sessão.
- Um ponto r1 recebe aviso temporário na interface principal para desligar e ligar Localização. Pontos r2 mantêm a interface limpa.
- A margem da última leitura continua separada na ajuda, apenas na memória da aba. Ela não é deduzida da região salva.
- Abrir a página ou a ajuda não solicita nova localização nem altera o ponto. A atualização ocorre somente após desligar/ligar a chave existente. Saldos e histórico não mudam.

Testes: regressão com a referência pública de Cete, mantendo centro legado e verificando deslocamento da nova grade. Quatro cenários desktop/mobile cobrem diagnóstico de margem, leitura do ponto legado sem escrita, retirada explícita, nova célula r2 e resolução preservada após recarregar. `npm run check`: 138 aprovados, um SQL local ignorado, build aprovado. Sem migração ou secret nova.
