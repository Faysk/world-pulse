# Teste público de localização aproximada de 1 km

Issue #123. Substitui o tamanho da grade informado em 42, 43 e 44, preservando a autorização única e a interface limpa.

## Grade e privacidade

`r2` divide a latitude em 20.040 faixas, com cerca de 999 m por faixa. A quantidade de colunas varia pelo cosseno da latitude para manter largura semelhante. Não é um raio de 1 km nem garantia de acurácia do sensor: o navegador pode fornecer localização imprecisa. Polos e arredondamento das colunas têm geometrias diferentes de um quadrado perfeito. Testes limitam o deslocamento até o centro da célula, inclusive nos polos, a menos de 1,1 km nos casos amostrados.

Coordenadas brutas continuam somente no callback do navegador; o servidor recebe `r2:linha:coluna`. O ponto público fica no centro dessa célula. Não coletamos trajetória nem acionamos localização em segundo plano. A região de 1 km pode revelar bairro ou permitir inferências, sobretudo em áreas pouco povoadas; não garante anonimato. Avisos PT/EN/ES atualizados na ajuda.

`r1` (cerca de 55 km) continua legível com exatamente os mesmos centros. Os registros antigos não são convertidos ou refinados: não temos as coordenadas originais. Para experimentar 1 km, a pessoa desliga e liga **Localização**, autorizando uma nova leitura. Saldos e histórico são preservados. Não há solicitação automática de permissão para usuários antigos.

## Banco e operação

Migração `0008-one-km-regions.sql`: amplia a restrição de formato para aceitar `r1` e `r2`, mantém os valores existentes e invalida o cache regional. Não altera permissões do runtime. Migração repetível, numa transação. API e store validam versão e limites completos além da restrição SQL de formato.

Staging e produção verificam a restrição `r2` pelo catálogo. A implantação de produção segue manutenção explícita, API desligada, migração por owner separado, fechamento da chave de migração e reativação. Nenhuma secret nova. O rollback de aplicação pode manter o banco ampliado; remover suporte r2 pode ocultar pontos novos em clientes antigos. Não fazer downgrade da restrição enquanto houver r2.

A grade mais fina pode gerar mais combinações célula/hashtag. O limite de 2.000 combinações por snapshot continua: acima dele a API falha explicitamente, sem truncar ou inventar pessoas. O tamanho visual em pixels dos pontos e o agrupamento por célula continuam os mesmos; o benefício espacial fica evidente com zoom de cidade. A proposta de agregação por zoom segue na issue #32.

## Validação

Teste de centros antigos fixos, quantização nova, antimeridiano, polos, limites, formatos inválidos e mais de 6 mil amostras de deslocamento. Integração SQL aplica a migração duas vezes, preserva r1, rejeita versão inválida e grava r2 com o runtime. Navegador verifica envio só da célula, negação, retirada, idioma e renderização. Staging/preview usam dados sintéticos isolados; não se força uma nova leitura da localização do usuário em produção.
