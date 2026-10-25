# Estado verificado antes da publicação — atualizado em 25/10/2026

**Publicação pausada.** O pacote de implementação/evidências é reunido no
[PR #31](https://github.com/Faysk/world-pulse/pull/31), milestone v0.4.
Integrá-lo à `main` não implanta nem ativa a alpha.
`map.faysk.dev` continua com a demonstração anterior. Não foi feito deploy de produção,
promoção, migração de domínio ou habilitação de participação em produção.

## O que está comprovado

| Parte | Resultado e evidência |
|---|---|
| Integração do código | [PR #31](https://github.com/Faysk/world-pulse/pull/31) e [PR #91](https://github.com/Faysk/world-pulse/pull/91) na main; integração não executou publicação ou migração de domínio |
| Infra existente | [40059556406](https://github.com/Faysk/world-pulse/actions/runs/40059556406): PostgreSQL TLS/runtime restrito e R2 privado write/read/delete aprovados |
| Site existente | HTTPS, HTML e assets JS/CSS de `map.faysk.dev` conferidos sem publicar; é a demonstração anterior |
| Neon staging | 0001–0006, grants, ausência de DDL e timeouts efetivos no pooler: [40058318799](https://github.com/Faysk/world-pulse/actions/runs/40058318799), [40058318548](https://github.com/Faysk/world-pulse/actions/runs/40058318548) |
| Plano de preview | [40058932667](https://github.com/Faysk/world-pulse/actions/runs/40058932667), sem acesso à Vercel ou publicação |
| App → banco remoto real | [40061344573](https://github.com/Faysk/world-pulse/actions/runs/40061344573): dois testes desktop/mobile via HTTPS privado, duas sessões, cookie seguro, saldos, recarga, retry e consentimento; quatro sessões sintéticas removidas no encerramento |
| Banco descartável e regressões | [40063608672](https://github.com/Faysk/world-pulse/actions/runs/40063608672): transações e dois navegadores na main aprovados, incluindo 205 históricos, idempotência, filas/abas e retenção |
| UI e três builds | [40063608553](https://github.com/Faysk/world-pulse/actions/runs/40063608553): produção fechada, preview por opt-in e alpha por flag separada; desktop/mobile aprovados, incluindo retirada de consentimento com geografia desativada |
| Operação futura de produção | [40064606694](https://github.com/Faysk/world-pulse/actions/runs/40064606694): 25 testes de infraestrutura aprovados. [Check 40064608407](https://github.com/Faysk/world-pulse/actions/runs/40064608407) atestou hostname/TLS/role e R2; sync, migração e deploy foram pulados |
| Geografia | SQL agregado por saldo positivo, consentimento opcional, supressão e polígonos nativos; [contrato e provas](31-country-geography.md). Fonte real da borda permanece desativada |
| Legibilidade | Tinta calculada e marcador preservando cor persistida, com provas de azul escuro em navegador; [limites](34-tag-label-readability.md) |

Localmente, após a composição multicolor, a suíte tem 133 testes: 132 aprovados e um SQL pulado por não haver
PostgreSQL local. O SQL foi executado separadamente no Actions. Os 25 testes de
infraestrutura e o build TypeScript/Vite passaram. Testes emulados não são
medidas de FPS ou gestos em dispositivos físicos. O benchmark de 0 a 1 trilhão
é de contagens/CPU agregadas, não de conexões concorrentes ou pessoas únicas.

## Estrutura real e controles fechados

- React/Vite/MapLibre; API server-side com PostgreSQL Neon. Sem Supabase no runtime.
- Cloudflare DNS-only para `map.faysk.dev`; R2 privado não participa dos taps.
  Geometria pública é asset estático versionado, sem objeto novo por clique.
- Conexões e credenciais em GitHub Environments production/staging. Valores de
  secrets não foram recuperados para a máquina. A inspeção de metadados da
  Vercel confirmou apenas DATABASE_URL, R2 e APP_URL no target production;
  proprietário de migração/token operacional não estão no runtime.
- GitHub production: `WP_ALPHA_RELEASE`, `WP_API_ENABLED`, `WP_GEO_PUBLIC_ENABLED`,
  `WP_GEO_COUNTRY_ENABLED` e `WP_GEO_DIRECT_EDGE` estão false. Staging sync foi habilitado apenas para o preview em 25/10; retenção horária está false no repositório e `WP_PRODUCTION_MIGRATIONS_ENABLED`
  está false em production. Nenhuma dessas ativações
  foi sincronizada/publicada nesta etapa.
- Plano/sync preview só aceita a branch de staging e runtime restrito. Retenção
  tem plano READ ONLY, execução limitada e resumo/backlog; continua desligada.
  O host atestado é centralizado em `WP_PRODUCTION_DB_HOST`. A futura migração
  manual está preparada e bloqueada por uma flag própria, sem executar SQL de
  domínio em produção; [guardas e limites](37-production-schema-preparation.md).
- Staging expira em **31/10/2026 01:15:25 UTC**. Recriar/renovar requer revisar
  destino, conexões, scripts e documentação; o código recusa operar após expirar.

## O que permanece como gate, sem marcar 100% por ficção

1. **Homologação complementar:** preview Vercel com banco staging, cookie e duas
   sessões pela API HTTPS aprovados em 25/10; Chrome real confirmou seleção, taps
   e reload. UI com duas sessões/mobile remoto e resposta realmente perdida não
   foram repetidas nesse preview; a prova anterior foi por HTTPS privado.
2. **Geografia real:** verificar borda direta, proxy, VPN, IPv6, rede móvel e
   desconhecido antes de habilitar fonte. O teste HTTPS privado usa certificado
   self-signed e não comprova headers/certificado público da Vercel.
3. **Operação antes do público:** conferir logs/backups/restore e métricas do
   provedor, aplicar migrações de produção em operação própria, atestar host e
   ativar/verificar retenção. Limites de banco não garantem custo zero ou DDoS.
4. **Visual/hardware:** o mapa oferece países multicolor com foco opcional, sem
   posição de pessoas. Composição orgânica multicolor simultânea é pesquisa
   separada (#32), e QA de touchpad/iOS/Android e FPS físico continua em #3/#12.

Isso distingue preparação técnica validada de aceite público completo. As
issues #5, #6, #7, #8, #13 e #53 continuam abertas pelos gates correspondentes.
Entregas de implementação #74, #76, #77, #79, #81, #83, #85, #88 e #90 foram concluídas em
PRs vinculados a milestones, sem fechar gates que não foram testados.

A sequência de liberação/interrupção/rollback está em
[operações antes da publicação](32-prepublication-operations.md). O teste remoto
sem Vercel e a captura de evidência estão em
[HTTPS privado de staging](35-staging-private-https-smoke.md).

## Avanço visual sem publicação

[Países multicolor](38-multicolor-countries.md): visão geral, foco, busca e páginas
de 20 hashtags. Faixas aproximadas preservam números exatos na lista. Composição
orgânica e FPS físico continuam pendentes; os gates operacionais não mudaram.

## Evidência da rodada multicolor e revisão de contratos

[PR #94](https://github.com/Faysk/world-pulse/pull/94) integrado com verificações
aprovadas: [PostgreSQL/duas sessões 40083393645](https://github.com/Faysk/world-pulse/actions/runs/40083393645)
e [UI, globo, build e gates 40083393632](https://github.com/Faysk/world-pulse/actions/runs/40083393632).
A suíte visual terminou com 48 testes aprovados e um cenário antigo mobile aprovado
no retry: a primeira execução excedeu 120s ao percorrer todos os cenários e capturas
na mesma função. Essa instabilidade não é prova de FPS ou desempenho físico.
Os contratos 02/10/14/24 foram alinhados à implementação. Sem deploy, migração de
domínio, ativação ou alteração de secrets nesta rodada.

A estabilização desse teste foi registrada na [issue #97](https://github.com/Faysk/world-pulse/issues/97),
com evidência do timeout e aceite separado de medição física.

## Retomada da Vercel — 25/10/2026

A quota de builds foi revalidada: um preview isolado do commit
`88fe0b4878982f137fcfeac41afedad161995272` terminou READY
(`dpl_GwZFjWfkDFMaETa1ptUq8bSsSzTN`). HTTPS autenticado retornou 200 para o HTML;
a proteção do preview foi mantida. Isso valida build/runtime estático, não
conexão do aplicativo ao staging nem fonte geográfica da borda.

[Check Neon 40229816651](https://github.com/Faysk/world-pulse/actions/runs/40229816651)
e [plano preview 40229862494](https://github.com/Faysk/world-pulse/actions/runs/40229862494)
aprovados novamente. A branch de staging foi avançada por fast-forward à main
revisada. Token de staging separado ainda pendente; nenhum valor da secret de
produção foi recuperado. Sync e deploy da experiência com banco continuam como
etapas distintas. Nenhuma migração, ativação ou alteração de domínio em produção.


## Staging na Vercel validado — 25/10/2026

Token restrito ao projeto e por sete dias salvo em staging/VERCEL_TOKEN; valor
production não recuperado. Sync 40230733906 e deploy/smoke
[40231987193](https://github.com/Faysk/world-pulse/actions/runs/40231987193)
aprovados. Duas sessões por HTTP, cookie seguro, saldos/retry/retorno/consentimento,
revogação de acesso temporário e limpeza de duas sessões comprovados. Chrome real
confirmou três segundos históricos após reload. [Detalhes e captura](32-prepublication-operations.md).

A quota não bloqueou os builds. Fonte de país permanece desligada; migrações de
domínio, retenção e alpha/API de produção não foram ativadas. O staging continua
expirando em 31/10/2026 01:15:25 UTC, antes do token (01/11). Registros anteriores
neste documento descrevem a sequência histórica, não novos bloqueios de quota.
