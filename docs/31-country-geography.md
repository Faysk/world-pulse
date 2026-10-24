# Geografia por país na experiência de homologação

Implementação da issue #74, integrada pelo PR #75 ao pacote da API. Código versionado não significa ativação em produção.

## Contrato real

`POST /api/session` recebe somente `geoConsent: boolean` opcional. O padrão é
false. País, latitude, longitude e headers enviados fora da borda confiável não
são fontes de localização. O usuário pode continuar participando sem compartilhar
o país; seus saldos e ranking não mudam. A retirada apaga o código da sessão,
invalida o cache agregado e mantém apenas `ZZ`. A data registra a última escolha,
sem manter histórico de países. A política de consolidação após 30 dias permanece.

A fonte só é aceita com **todos**: `VERCEL=1`, `WP_GEO_COUNTRY_ENABLED=true` e
`WP_GEO_DIRECT_EDGE=true`. A última variável exige atestar que a requisição chega
diretamente à borda Vercel, sem proxy que faça seu próprio IP parecer o usuário.
Por padrão a fonte é `ZZ`. VPNs, provedores e bases de IP podem errar. Ainda falta
verificar headers e fluxo real no staging HTTPS; testes com headers controlados
não comprovam esse comportamento remoto. O DNS-only atual é necessário, mas
não substitui a verificação. Nunca usar cabeçalhos arbitrários de país como fallback.

`GET /api/countries` requer `WP_API_ENABLED=true` **e**
`WP_GEO_PUBLIC_ENABLED=true`. Ambos permanecem desligados em produção. Retorna
somente contagens de sessões com saldo positivo por hashtag/país. Contagens são
strings decimais e somas usam BigInt. Cinco sessões é o mínimo para nomear um país
por hashtag; grupos menores vão para `OTHER`, sem país. Sem consentimento, código
inválido ou fonte confiável, vão para `ZZ`. Isso não identifica pessoas únicas.

Não há nomes de sessão, cookies, IP bruto, cidade ou coordenadas de pessoas no
payload. A cache SQL tem uma única linha e janela de 5 segundos; responde
`Cache-Control: no-store`. O cliente atualiza apenas em abas visíveis e remove o
desenho quando a leitura falha. Retirar consentimento e atualizar o cache usam
o mesmo advisory lock, impedindo uma atualização concorrente de republicar a
fotografia anterior após a retirada. Leituras já entregues ou em trânsito não
podem ser recuperadas. Comparações temporais podem revelar mudanças: limiar 5
**não é garantia de anonimato**, nem proteção contra ataques de diferenciação.
Máximo de 5.000 grupos SQL; ultrapassar falha explicitamente em vez de truncar.
Orçamentos compartilhados e timeouts também se aplicam à leitura.

## Visual e limites

O globo usa polígonos nativos MapLibre, uma source e duas layers, com várias
hashtags por país e foco opcional na selecionada. Até quatro cores e cinza para
as demais compõem faixas aproximadas; busca e paginação preservam acesso a todas
as hashtags e seus números exatos. [Algoritmo e limites](38-multicolor-countries.md).
Sem país conhecido, não há área de participação. `OTHER` e `ZZ` ficam na lista.
A área não codifica quantidade ou posição de pessoas. Tocar numa área inspeciona
o país e não adiciona tempo; botão +1 e taps elegíveis fora dela mantêm a interação.

Natural Earth 110m, 174 países/territórios com código disponível, é um desenho
generalizado. Algumas ilhas, microestados e territórios ficam sem geometria;
suas contagens continuam na lista pelo código, sem posição inventada. Fronteiras
são cartográficas, não uma declaração política. O arquivo é servido localmente,
sem enviar identificação do participante ao fornecedor. Fonte, versão e licença
estão em [COUNTRIES-SOURCE](../src/assets/COUNTRIES-SOURCE.md).

Faixas multicolor com foco opcional são um fallback funcional. Composição orgânica
multicolor simultânea e FPS em aparelho físico continuam na issue #32, e não
foram comprovados pelos laboratórios sintéticos. Bilhões de contagens podem ser
representados aritmeticamente; isso não significa bilhões de conexões suportadas.

## Verificação e liberação

Migração `0006-country-geography.sql` é aditiva e idempotente. O teste PostgreSQL
descartável valida consentimento, retirada, supressão, expiração e cache. Os
testes de contrato validam origem fechada por padrão, códigos atribuídos e
contagens acima de Number.MAX_SAFE_INTEGER. O navegador usa fixtures explícitas
para a visualização de países; isso não comprova a estimativa pela borda.

Antes de liberar: CI verde; aplicar 0006 **somente staging**; conferir privilégios;
testar HTTPS com duas sessões, opt-in/opt-out, país desconhecido e proxy; revisar
texto de privacidade; conferir hardware e custos. Não ativar flags de produção
ou migrar o domínio de produção como consequência de um build bem-sucedido.

O código XK do dataset é de uso excepcional e não pertence à lista ISO atribuída usada pela API; seu polígono foi omitido, sem inferir outro país.

## Evidência de 24/10/2026

- PostgreSQL e dois navegadores: [40058311911](https://github.com/Faysk/world-pulse/actions/runs/40058311911), aprovados.
- Build, gates compilados e UI desktop/mobile: [40058311961](https://github.com/Faysk/world-pulse/actions/runs/40058311961), aprovados.
- Migração 0001–0006 e acesso restrito no Neon staging: [40058318799](https://github.com/Faysk/world-pulse/actions/runs/40058318799), aprovado.
- Check de staging após migração: [40058318548](https://github.com/Faysk/world-pulse/actions/runs/40058318548), aprovado na repetição após o schema novo existir.
- Oito testes locais de UI/renderer em desktop e celular emulado aprovados, inclusive inspeção sem crédito. Emulação não é teste de hardware físico.

## Atualização segura durante gestos (#81)

Source e duas layers permanecem estáveis até desmontar o mapa; snapshots mudam somente dados/cor. A geometria pública é carregada/parseada uma vez por página, com timeout e retry após falha, sem mutar a coleção compartilhada. Ausência de dados limpa as features, sem reconstruir recursos a cada 5s.

O país sob o pointerdown fica associado apenas à intenção daquele gesto elegível. Se a área desaparecer antes da soltura, o gesto continua sendo inspeção e nunca vira crédito. Drag/pinch/wheel/long-press continuam passando pelo mesmo reconhecedor. Teste de globo verifica refresh sem nova geometria/source, retirada da área durante o gesto, ausência de taps acidentais e liberação dos recursos no unmount. Nada é persistido dessa intenção do ponteiro.

## Desativação e retirada da preferência (#88)

Com a API/sessão ainda disponível, desligar a capability geográfica não impede
uma pessoa já consentida de retirar a opção. Opt-in fica bloqueado nesse estado;
depois do opt-out, o checkbox fica desativado até nova disponibilidade. A UI
limpa a leitura anterior e descarta respostas em trânsito anteriores à mudança,
inclusive durante atualização de consentimento. Falha no pedido informa que a
preferência não foi confirmada, sem fingir sucesso. Isso não elimina cópias já
recebidas por terceiros nem permite autenticar uma sessão cujo cookie foi perdido.

Teste em desktop/mobile cobre país visível, leitura seguinte retida em trânsito,
desativação/refresh de sessão, descarte dessa resposta e retirada autenticada,
mantendo o saldo e sem criar taps. O backend continua com os mesmos gates.
