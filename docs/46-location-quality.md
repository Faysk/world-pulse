# Qualidade da localização do navegador

Issue #126. Relato: ponto perto de Moreira apesar de o usuário estar em Cete; celular no mesmo Wi-Fi retorna posição semelhante. Isso sugere um problema no provedor de localização ou estimativa de rede, mas não demonstra a origem. A API não informa se usou GPS, Wi-Fi, IP ou outra combinação. Não forçamos coordenadas de Cete nem movemos pontos por suposição.

## Correção

A solicitação passou de `enableHighAccuracy:false` para `true`, sem cache (`maximumAge:0`), uma única leitura com timeout de 20 segundos. O navegador pode ignorar a preferência ou não conseguir uma posição melhor. Nenhum rastreamento contínuo foi adicionado.

Antes da quantização, o cliente exige `coords.accuracy` numérico, finito, não negativo e até 1.000 metros. Valores ausentes, negativos, não finitos ou maiores são recusados sem POST de localização. O aviso EN/PT/ES orienta ativar localização precisa para o navegador. Taps continuam disponíveis. Uma falha não altera um ponto já salvo: é possível retirá-lo desligando Localização.

A margem fica somente no callback local; não é persistida nem enviada ao servidor. Coordenadas continuam arredondadas para a grade r2 de aproximadamente 1 km antes do envio. A margem do provedor e o arredondamento são fontes de erro distintas; aceitar margem até 1 km não garante distância real até o ponto inferior a 1 km.

Uma leitura incorreta pode vir acompanhada de uma margem pequena. Essa checagem não detecta esse caso nem autentica presença ou GPS; clientes modificados também podem burlá-la. A ajuda declara esse limite. O país dos resumos continua separado, estimado pela conexão, sem servir de coordenada para o ponto.

Referência: [W3C Geolocation](https://www.w3.org/TR/geolocation/), `enableHighAccuracy` e `accuracy`. O primeiro é uma preferência; o segundo é o raio de precisão informado pelo provedor, com confiança estatística de 95%, não prova de localização correta.

## Validação

Seis testes de navegador em desktop/mobile: solicitação com alta precisão e sem cache, rejeição de margens de 25 km/1.001 m/NaN/negativa, nenhuma escrita nessas recusas, taps disponíveis, aceitação de leitura de 25 m e envio somente da célula r2. Regressões de autorização negada e retirada preservadas. `npm run check`: 138 aprovados, um SQL local ignorado, build aprovado. Sem migração ou secret nova. Não foi possível comparar dados móveis: o usuário informou não ter dados disponíveis. A causa do provedor permanece uma hipótese.
